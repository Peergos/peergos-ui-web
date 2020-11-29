module.exports = {
    template: require('filesystem.html'),
    data: function() {
        return {
            contextUpdates: 0,
            path: [],
            searchPath: null,
            currentDir: null,
	    files: [],
            grid: true,
            sortBy: "name",
            normalSortOrder: true,
            clipboard:{},
            selectedFiles:[],
            url:null,
            viewMenu:false,
            ignoreEvent:false,
            top:"0px",
            left:"0px",
	    showTour: false,
            showShare:false,
            sharedWithState: null,
            sharedWithData:{"edit_shared_with_users":[],"read_shared_with_users":[]},
            forceSharedRefreshWithUpdate:0,
            isNotBackground: true,
	    quota: "N/A",
	    usageBytes: 0,
	    isAdmin: false,
            showAdmin:false,
            showGallery: false,
            showSocial:false,
            showTimeline:false,
            showSearch:false,
            showHexViewer:false,
            showCodeEditor:false,
            showPdfViewer:false,
            showTextViewer:false,
            showPassword:false,
            showAccount:false,
            showRequestSpace:false,
            showBuySpace:false,
	    paymentProperties:{},
            showSettingsMenu:false,
            showUploadMenu:false,
            showFeedbackForm: false,
            showSideNav: false,
            showTodoBoardViewer: false,
            newTodoBoardName: null,
            showCalendarViewer: false,
            showProfileEditForm: false,
            showProfileViewForm: false,
	    admindata: {pending:[]},
            social:{
                pending: [],
                friends: [],
                followers: [],
                following: []
            },
            profile:{
                firstName: "",
                lastName: "",
                biography: "",
                primaryPhone: "",
                primaryEmail: "",
                profileImage: "",
                status: "",
                webRoot: ""
            },
            messages: [],
            messageId: null,
            progressMonitors: [],
            messageMonitors: [],
            conversationMonitors: [],
            clipboardAction:"",
            forceUpdate:0,
            externalChange:0,
            prompt_message: '',
            prompt_placeholder: '',
            prompt_max_input_size: null,
            prompt_value: '',
            prompt_consumer_func: () => {},
            showCreate: false,
            showPrompt: false,
            showWarning: false,
            showReplace: false,
	        warning_message: "",
	        warning_body: "",
            warning_consumer_func: () => {},
            replace_message: "",
            replace_body: "",
            replace_consumer_cancel_func: (applyToAll) => {},
            replace_consumer_func: (applyToAll) => {},
            replace_showApplyAll: false,
            errorTitle:'',
            errorBody:'',
            showError:false,
            showSpinner: true,
            spinnerMessage: '',
            onUpdateCompletion: [] // methods to invoke when current dir is next refreshed
        };
    },
    props: ["context", "newsignup", "initPath", "opengallery", "initiateDownload"],
    created: function() {
        console.debug('Filesystem module created!');
        this.showTour = this.newsignup;
        this.init();
        window.onhashchange = this.onUrlChange;
    },
    watch: {
        // manually encode currentDir dependencies to get around infinite dependency chain issues with async-computed methods
        context: function(newContext, oldContext) {
	    this.contextUpdates++;
            this.updateCurrentDir();
            this.updateFollowerNames();
	    if (newContext != null && newContext.username != null) {
		this.updateUsage();
		this.updateQuota();
		const that = this;
		newContext.getPendingSpaceRequests().thenApply(reqs => {
		    that.isAdmin = true;
		});
	    }
        },

        path: function(newPath, oldPath) {
            if (newPath.length != oldPath.length) {
                    this.updateCurrentDir();
            } else {
                for (var i=0; i < newPath.length; i++) {
                    if (newPath[i] != oldPath[i]) {
                        this.updateCurrentDir();
			return;
                    }
                }
            }
        },
        forceSharedRefreshWithUpdate: function(newCounter, oldCounter) {
            this.updateCurrentDir();
        },
        forceUpdate: function(newUpdateCounter, oldUpdateCounter) {
            this.updateCurrentDir();
        },

	externalChange: function(newExternalChange, oldExternalChange) {
	    let that = this;
	    this.updateSocial(function(res) {that.updateCurrentDir();});
	},

	files: function(newFiles, oldFiles) {
	    if (newFiles == null)
		return;
	    
	    if (oldFiles == null && newFiles != null)
		return this.processPending();

	    if (oldFiles.length != newFiles.length) {
		this.processPending();
	    } else {
		for (var i=0; i < oldFiles.length; i++)
		    if (! oldFiles[i].equals(newFiles[i]))
			return this.processPending();
	    }
	}
    },
    methods: {
	init: function() {
	    const that = this;
            if (this.context != null && this.context.username == null) {
                // from a secret link
                this.context.getEntryPath().thenApply(function(linkPath) {
		    var path = that.initPath == null ? null : decodeURIComponent(that.initPath);
		    if (path != null &&
			(path.startsWith(linkPath) || linkPath.startsWith(path)))
			that.changePath(path);
		    else
			that.changePath(linkPath);
                    if (that.initiateDownload) {
                        that.context.getByPath(that.getPath())
                            .thenApply(function(file){file.get().getChildren(that.context.crypto.hasher, that.context.network).thenApply(function(children){
                                var arr = children.toArray();
                                if (arr.length == 1)
                                    that.downloadFile(arr[0]);
                            })});
                    }
		    that.showGallery = that.opengallery;
                });
		
            } else {
		const props = this.getPropsFromUrl();
		var pathFromUrl = props == null ? null : props.path;
		if (pathFromUrl != null) {
		    this.showSpinner = true;
		    const filename = props.filename;
		    const app = props.app;
		    var open = () => {
			that.openInApp(filename, app);
		    };
		    this.onUpdateCompletion.push(open);
		    this.path = pathFromUrl.split('/').filter(n => n.length > 0);
		} else {
		    this.path = [this.context.username];
		    this.updateHistory("filesystem", this.getPath(), "");
		}
                this.updateSocial();
		this.updateUsage();
		this.updateQuota();
		this.context.getPendingSpaceRequests().thenApply(reqs => {
		    that.isAdmin = true;
		});
        this.context.getPaymentProperties(false).thenApply(function(paymentProps) {
            if (paymentProps.isPaid()) {
                that.paymentProperties = paymentProps;
            }
        });
            }
        this.showPendingServerMessages();
	},
	showPendingServerMessages: function() {
        let context = this.getContext();
        let that = this;
        context.getServerConversations().thenApply(function(conversations){
            let allConversations = [];
            let conv = conversations.toArray();
            conv.forEach(function(conversation){
                let arr = conversation.messages.toArray();
                let lastMessage = arr[arr.length - 1];
                allConversations.push({id: lastMessage.id(), sendTime: lastMessage.getSendTime().toString().replace("T", " "),
                    contents: lastMessage.getContents(), previousMessageId: lastMessage.getPreviousMessageId(),
                    from: lastMessage.getAuthor(), msg: lastMessage});
                arr.forEach(function(message){
                    that.messageMonitors.push({id: message.id(), sendTime: message.getSendTime().toString().replace("T", " "),
                        contents: message.getContents(), previousMessageId: message.getPreviousMessageId(),
                        from: message.getAuthor(), msg: message});
                });
            });
            if(allConversations.length > 0) {
                Vue.nextTick(function() {
                    allConversations.forEach(function(msg){
                        that.conversationMonitors.push(msg);
                    });
                });
            }
        }).exceptionally(function(throwable) {
            throwable.printStackTrace();
        });
	},
    processPending: function() {
        for (var i=0; i < this.onUpdateCompletion.length; i++) {
            this.onUpdateCompletion[i].call();
        }
        this.onUpdateCompletion = [];
    },

	roundToDisplay: function(x) {
	    return Math.round(x * 100)/100;
	},

        convertBytesToHumanReadable: function(bytes) {
	    if (bytes < 1024)
		return bytes;
	    if (bytes < 1024*1024)
		return this.roundToDisplay(bytes/1024) + " KiB";
	    if (bytes < 1024*1024*1024)
		return this.roundToDisplay(bytes/1024/1024) + " MiB";
	    return this.roundToDisplay(bytes/1024/1024/1024) + " GiB";
	},

	updateUsage: function() {
	    var context = this.getContext();
            if (this.isSecretLink)
		return;
	    var that = this;
	    this.context.getSpaceUsage().thenApply(u => that.usageBytes = u.value_0);
	},

	updateQuota: function() {
	    var context = this.getContext();
            if (this.isSecretLink)
		return;
	    var that = this;
	    this.context.getQuota().thenApply(q => that.quota = that.convertBytesToHumanReadable(q));
	},

	updateHistory: function(app, path, filename) {
	    if (this.isSecretLink)
		return;
	    const currentProps = this.getPropsFromUrl();
	    const pathFromUrl = currentProps == null ? null : currentProps.path;
	    const appFromUrl = currentProps == null ? null : currentProps.app;
	    if (path == pathFromUrl && app == appFromUrl)
		return;
	    var rawProps = propsToFragment({app:app, path:path, filename:filename});
	    var props = this.encryptProps(rawProps);
	    window.location.hash = "#" + propsToFragment(props);
	},

	getPropsFromUrl: function() {
	    try {
		return this.decryptProps(fragmentToProps(window.location.hash.substring(1)));
	    } catch(e) {
		return null;
	    }
	},
	
	encryptProps: function(props) {
	    var context = this.getContext();
	    var both = context.encryptURL(props)
	    const nonce = both.base64Nonce;
	    const ciphertext = both.base64Ciphertext;
	    return {nonce:nonce, ciphertext:ciphertext};
	},

	decryptProps: function(props) {
	    if (this.isSecretLink)
		return path;
	    var context = this.getContext();
	    return fragmentToProps(context.decryptURL(props.ciphertext, props.nonce));
	},

	onUrlChange: function() {
	    const props = this.getPropsFromUrl();
	    const path = props == null ? null : props.path;
	    const filename = props == null ? null : props.filename;
	    const app = props == null ? null : props.app;
	    const that = this;
	    const differentPath = path != null && path != this.getPath();
	    if (differentPath)
		this.path = path.split("/").filter(x => x.length > 0);

	    if (app == "filesystem") {
		this.showGallery = false;
		this.showPdfViewer = false;
		this.showCodeEditor = false;
		this.showTextViewer = false;
		this.showHexViewer = false;
		this.showTimeline = false;
		this.showTodoBoardViewer = false;
		this.showCalendarViewer = false;
	    } else {
		if (! differentPath)
		    this.openInApp(filename, app);
		else
		    this.onUpdateCompletion.push(() => {
			that.openInApp(filename, app);
		    });
	    }
	},

	closeApps: function() {
	    this.showGallery = false;
	    this.showPdfViewer = false;
	    this.showCodeEditor = false;
	    this.showTextViewer = false;
	    this.showHexViewer = false;
	    this.showTodoBoardViewer = false;
	    this.showCalendarViewer = false;
            this.selectedFiles = [];
            this.updateHistory("filesystem", this.getPath(), "");
	    this.forceSharedRefreshWithUpdate++;
	},
	reloadCalendar: function() {
        this.closeApps();
        let that = this;
        setTimeout(function(){
            that.toggleNav();
            that.showCalendar();
        },600);
    },
    navigateToAction: function(directory) {
        let newPath = directory.startsWith("/") ? directory.substring(1).split('/') : directory.split('/');
        let currentPath = this.path;
        if (newPath.length != currentPath.length) {
                this.changePath(directory);
        } else {
            for (var i=0; i < newPath.length; i++) {
                if (newPath[i] != currentPath[i]) {
                    this.changePath(directory);
                    return;
                }
            }
        }
    },
    viewAction: function(path, filename) {
        this.showSpinner = true;
        if (path.startsWith("/"))
            path = path.substring(1);
        this.path = path ? path.split('/') : [];
        this.viewingFromTimeline = true;
        this.updateHistory("filesystem", path, "");
        this.updateCurrentDirectory(filename);
    },
	openInApp: function(filename, app) {
	    this.selectedFiles = this.files.filter(f => f.getName() == filename);
	    if (this.selectedFiles.length == 0)
		return;
	    if (app == "gallery")
		this.showGallery = true;
	    else if (app == "pdf")
		this.showPdfViewer = true;
	    else if (app == "editor")
		this.showCodeEditor = true;
	    else if (app == "hex")
		this.showHexViewer = true;
	    else if (app == "todo")
		this.showTodoBoardViewer = true;
	    else if (app == "calendar")
		this.showCalendarViewer = true;
	    else if (app == "timeline")
		this.showTimeline = true;
	},
    openSearch: function(fromRoot) {
        this.searchPath = fromRoot ? "/" + this.getContext().username
            : this.getPath() + this.selectedFiles[0].getFileProperties().name;
        this.showSearch = true;
        this.closeMenu();
    },
	updateCurrentDir: function() {
	    this.updateCurrentDirectory(null);
	},
	updateCurrentDirectory: function(selectedFilename) {
            var context = this.getContext();
            if (context == null)
                return Promise.resolve(null);
            var path = this.getPath();
            var that = this;
            context.getByPath(path).thenApply(function(file){
                that.currentDir = file.get();
                that.updateFiles(selectedFilename);
            }).exceptionally(function(throwable) {
                console.log(throwable.getMessage());
            });
        },
        updateFiles: function(selectedFilename) {
            var current = this.currentDir;
            if (current == null)
                return Promise.resolve([]);
            let that = this;
            let context = this.getContext();
            let path = that.path.length == 0 ? ["/"] : that.path;
            let directoryPath = peergos.client.PathUtils.directoryToPath(path);
            context.getDirectorySharingState(directoryPath).thenApply(function(updatedSharedWithState) {
                current.getChildren(context.crypto.hasher, context.network).thenApply(function(children){
                    that.sharedWithState = updatedSharedWithState;
                    var arr = children.toArray();
                    that.showSpinner = false;
                    that.files = arr.filter(function(f){
                        return !f.getFileProperties().isHidden;
                    });
                    if(selectedFilename != null) {
                        that.selectedFiles = that.files.filter(f => f.getName() == selectedFilename);
                        that.gallery();
                    } else {
                        that.sharedWithDataUpdate();
                    }
                }).exceptionally(function(throwable) {
                    console.log(throwable.getMessage());
                });
            }).exceptionally(function(throwable) {
                console.log(throwable.getMessage());
            });
        },

	updateSocial: function(callbackFunc) {
	    var context = this.getContext();
            if (context == null || context.username == null)
                this.social = {
                    pending: [],
		    friends: [],
                    followers: [],
                    following: [],
		    pendingOutgoing: [],
		    annotations: {}
                };
	    else {
		    var that = this;
            context.getSocialState().thenApply(function(social){
		    var annotations = {};
		    social.friendAnnotations.keySet().toArray([]).map(name => annotations[name]=social.friendAnnotations.get(name));
		    var followerNames = social.followerRoots.keySet().toArray([]);
		    var followeeNames = social.followingRoots.toArray([]).map(function(f){return f.getFileProperties().name});
		    var friendNames = followerNames.filter(x => followeeNames.includes(x));
		    followerNames = followerNames.filter(x => !friendNames.includes(x));
		    followeeNames = followeeNames.filter(x => !friendNames.includes(x));
		    that.social = {
                        pending: social.pendingIncoming.toArray([]),
			friends: friendNames,
                        followers: followerNames,
                        following: followeeNames,
                        pendingOutgoing: social.pendingOutgoingFollowRequests.keySet().toArray([]),
			annotations: annotations
		    };
		    if (callbackFunc != null) {
		        callbackFunc(true);
		    }
                }).exceptionally(function(throwable) {
		    that.errorTitle = 'Error retrieving social state';
		    that.errorBody = throwable.getMessage();
		    that.showError = true;
		    that.showSpinner = false;
            if (callbackFunc != null) {
                callbackFunc(false);
            }
		});
	    }
	},

        updateFollowerNames: function() {
            var context = this.getContext();
            if (context == null || context.username == null)
                return Promise.resolve([]);
            var that = this;
            context.getFollowerNames().thenApply(function(usernames){
                that.followerNames = usernames.toArray([]);
            });
        },
        sharedWithDataUpdate: function() {
            var context = this.getContext();
            if (this.selectedFiles.length != 1 || context == null) {
                this.sharedWithData = {read_shared_with_users:[], edit_shared_with_users:[] };
                return;
            }
            var file = this.selectedFiles[0];
            var filename = file.getFileProperties().name;

            let latestFile = this.files.filter(f => f.getName() == filename)[0];
            this.selectedFiles = [latestFile];
            let fileSharedWithState = this.sharedWithState.get(filename);
            let read_usernames = fileSharedWithState.readAccess.toArray([]);
            let edit_usernames = fileSharedWithState.writeAccess.toArray([]);
            this.sharedWithData = {read_shared_with_users:read_usernames, edit_shared_with_users:edit_usernames};
        },
        getContext: function() {
            var x = this.contextUpdates;
            return this.context;
        },

        getThumbnailURL: function(file) {
	    // cache thumbnail to avoid recalculating it
	    if (file.thumbnail != null)
		return file.thumbnail;
            var thumb = file.getBase64Thumbnail();
	    file.thumbnail = thumb;
	    return thumb;
        },
        goBackToLevel: function(level) {
            // By default let's jump to the root.
            var newLevel = level || 0,
            path = this.path.slice(0, newLevel).join('/');

            if (newLevel < this.path.length) {
                this.changePath(path);
            }
        },

        goHome: function() {
            this.changePath("/");
	    this.toggleNav();
        },

        askMkdir: function() {
            this.prompt_placeholder='Folder name';
            this.prompt_message='Enter a new folder name';
            this.prompt_value='';
            this.prompt_consumer_func = function(prompt_result) {
                if (prompt_result === null)
                    return;
                let folderName = prompt_result.trim();
                if (folderName === '')
                    return;
                if (folderName === '.' || folderName === '..')
                    return;
                this.mkdir(folderName);
            }.bind(this);
            this.showPrompt = true;
        },
        confirmDelete: function(file, deleteFn) {
	        var extra = file.isDirectory() ? " and all its contents" : "";
            this.warning_message='Are you sure you want to delete ' + file.getName() + extra +'?'; 
            this.warning_body='';
            this.warning_consumer_func = deleteFn;
            this.showWarning = true;
        },

        confirmDownload: function(file, downloadFn) {
            var size = this.getFileSize(file.getFileProperties());
            if (this.supportsStreaming() || size < 50*1024*1024)
                return downloadFn();
            var sizeMb = (size/1024/1024) | 0;
            this.warning_message='Are you sure you want to download ' + file.getName() + " of size " + sizeMb +'MB?';
            if(this.detectFirefoxWritableSteams()) {
                this.warning_body="Firefox has added support for streaming behind a feature flag. To enable streaming; open about:config, enable 'javascript.options.writable_streams' and then open a new tab";
            } else {
                this.warning_body="We recommend Chrome for downloads of large files. Your browser doesn't support it and may crash or be very slow";
            }
            this.warning_consumer_func = downloadFn;
            this.showWarning = true;
        },

        confirmView: function(file, viewFn) {
	        var size = this.getFileSize(file.getFileProperties());
	        if (this.supportsStreaming() || size < 50*1024*1024)
		        return viewFn();
	        var sizeMb = (size/1024/1024) | 0;
            this.warning_message='Are you sure you want to view ' + file.getName() + " of size " + sizeMb +'MB?'; 
            if(this.detectFirefoxWritableSteams()) {
                this.warning_body="Firefox has added support for streaming behind a feature flag. To enable streaming; open about:config, enable 'javascript.options.writable_streams' and then open a new tab";
            } else {
                this.warning_body="We recommend Chrome for downloads of large files. Your browser doesn't support it and may crash or be very slow";
            }
            this.warning_consumer_func = viewFn;
            this.showWarning = true;
        },

        switchView: function() {
            this.grid = !this.grid;
        },

        currentDirChanged: function() {
            // force reload of computed properties
            this.forceUpdate++;
        },

	gotoSignup: function() {
	    var url = window.location.origin + window.location.pathname + "?signup=true";
	    this.openLinkInNewTab(url);
	},

        openLinkInNewTab: function(url) {
	    let link = document.createElement('a')
            let click = new MouseEvent('click')

	    link.rel = "noopener noreferrer";
	    link.target = "_blank"
            link.href = url
            link.dispatchEvent(click)
	},

        mkdir: function(name) {
            var context = this.getContext();
            this.showSpinner = true;
            var that = this;

            this.currentDir.mkdir(name, context.network, false, context.crypto)
                .thenApply(function(updatedDir){
		    that.currentDir = updatedDir;
		    that.updateFiles();
		    that.onUpdateCompletion.push(function() {
                        that.showSpinner = false;
		    });
		    that.updateUsage();
                }.bind(this)).exceptionally(function(throwable) {
		    that.errorTitle = 'Error creating directory: ' + name;
		    that.errorBody = throwable.getMessage();
		    that.showError = true;
		    that.showSpinner = false;
		    that.updateUsage();
		});
        },

        askForFiles: function() {
            this.toggleUploadMenu();
            document.getElementById('uploadFileInput').click();
        },

        askForDirectories: function() {
            this.toggleUploadMenu();
            document.getElementById('uploadDirectoriesInput').click();
        },

        dndDrop: function(evt) {
            evt.preventDefault();
            let entries = evt.dataTransfer.items;
            let allItems = [];
            for(i=0; i < entries.length; i ++) {
                let entry = entries[i].webkitGetAsEntry();
                if(entry != null) {
                    allItems.push(entry);
                }
            }
            let allFiles = [];
            if (allItems.length > 0) {
                this.getEntries(allItems, 0, this, allFiles);
            }
        },
        getEntries: function(items, itemIndex, that, allFiles) {
                if (itemIndex < items.length) {
                    let item = items[itemIndex];
                    if (item.isDirectory){
                           let reader = item.createReader();
                           let doBatch = function() {
                                reader.readEntries(function(entries) {
                                    if (entries.length > 0) {
                                        for(i=0; i < entries.length; i ++) {
                                            items.push(entries[i]);
                                        }
                                        doBatch();
                                    } else {
                                        that.getEntries(items, ++itemIndex, that, allFiles);
                                    }
                                });
                           };
                           doBatch();
                    }else{
                        allFiles.push(item);
                        that.getEntries(items, ++itemIndex, that, allFiles);
                    }
                } else {
                    let uploadPath = this.getPath();
                    var replaceParams = {
                        applyReplaceToAll : false,
                        replaceFile : false,
                        fileInfoStore : []
                    };
                    var future = peergos.shared.util.Futures.incomplete();
                    this.showSpinner = true;
                    if(allFiles.length > 10) {
                        this.spinnerMessage = "preparing for upload";
                    }
                    this.traverseDirectories(uploadPath, uploadPath, null, 0, allFiles, 0, true, replaceParams, future);
                    let that = this;
                    future.thenApply(done => {
                        this.spinnerMessage = "";
                        that.updateFiles();
                        let counter = replaceParams.fileInfoStore.length;
                        replaceParams.fileInfoStore.forEach(file => {
                          that.uploadFileFromFileInfo(file).thenApply(res => {
                              counter--;
                              if(counter ==0) {
                                that.progressMonitors.length = 0;
                              }
                          });
                        });
                    });
                }
        },
        uploadFiles: function(evt) {
            let uploadPath = this.getPath();
            var files = evt.target.files || evt.dataTransfer.files;
            var replaceParams = {
                applyReplaceToAll : false,
                replaceFile : false,
                fileInfoStore : []
            };
            var future = peergos.shared.util.Futures.incomplete();
            this.showSpinner = true;
            if(files.length > 10) {
                this.spinnerMessage = "preparing for upload";
            }
            this.traverseDirectories(uploadPath, uploadPath, null, 0, files, 0, false, replaceParams, future);
            let that = this;
            future.thenApply(done => {
                this.spinnerMessage = "";
                that.updateFiles();
                let counter = replaceParams.fileInfoStore.length;
                replaceParams.fileInfoStore.forEach(file => {
                  that.uploadFileFromFileInfo(file).thenApply(res => {
                      counter--;
                      if(counter ==0) {
                        that.progressMonitors.length = 0;
                      }
                  });
                });

            });
        },
        splitDirectory: function (dir, fromDnd) {
            if (fromDnd) {
                return dir.fullPath.substring(1).split('/');
            } else {
                return dir.webkitRelativePath.split('/');
            }
        },
        traverseDirectories: function(origDir, currentDir, dirs, dirIndex, items, itemIndex, fromDnd, replaceParams, future) {
            if (dirs == null) {
                if (itemIndex < items.length) {
                    dirs = this.splitDirectory(items[itemIndex], fromDnd);
                } else {
                    future.complete(true);
                    return;
                }
            }
            var that = this;
            this.context.getByPath(currentDir).thenApply(function(updatedDirOpt){
                let updatedDir = updatedDirOpt.get();
                if (dirIndex < dirs.length - 1) {
                    let dirName = dirs[dirIndex];
                    let path = currentDir + dirName + "/" ;

                    updatedDir.hasChild(dirName, that.context.crypto.hasher, that.context.network)
                        .thenApply(function(alreadyExists){
                            if (alreadyExists) {
                                if (itemIndex == 0) {
                                    that.confirmReplaceDirectory(dirName,
                                    (applyToAll) => {
                                        replaceParams.applyReplaceToAll = applyToAll;
                                        replaceParams.replaceFile = false;
                                        future.complete(true);
                                    },
                                    (applyToAll) => {
                                        replaceParams.applyReplaceToAll = applyToAll;
                                        replaceParams.replaceFile = true;
                                        that.traverseDirectories(origDir, path, dirs, ++dirIndex, items, itemIndex, fromDnd, replaceParams, future);
                                    }
                                    );
                                } else {
                                    that.traverseDirectories(origDir, path, dirs, ++dirIndex, items, itemIndex, fromDnd, replaceParams, future);
                                }
                            } else {
                                updatedDir.mkdir(dirName, that.context.network, false, that.context.crypto)
                                    .thenApply(function(updated){
                                        if (dirIndex == 0) {
                                            that.currentDir = updated;
                                        }
                                        that.traverseDirectories(origDir, path, dirs, ++dirIndex, items, itemIndex, fromDnd, replaceParams, future);
                                });
                            }
                        });
                } else {
                    let file = items[itemIndex];
                    let refreshDir = that.getPath() == currentDir ? true : false;
                    that.uploadFilesFromDirectory(that, refreshDir, origDir, currentDir, dirs, dirIndex, items, itemIndex, fromDnd, replaceParams, future);
                }
            });
        },
        confirmReplaceDirectory: function(dirName, cancelFn, replaceFn) {
            this.showSpinner = false;
            this.replace_message='Directory: "' + dirName + '" already exists in this location. Do you wish to continue?';
            this.replace_body='';
            this.replace_consumer_cancel_func = cancelFn;
            this.replace_consumer_func = replaceFn;
            this.replace_showApplyAll = false;
            this.showReplace = true;
        },
        uploadFilesFromDirectory: function(that, refreshDir, origDir, currentDir, dirs, dirIndex, items, itemIndex, fromDnd, replaceParams, future) {
            //optimisation - Next entry will likely be in the same directory
            if(itemIndex < items.length) {
                let nextFile = items[itemIndex];
                let nextDirs = that.splitDirectory(nextFile, fromDnd);
                let sameDirectory = dirs.length == nextDirs.length;
                 if (sameDirectory) {
                    for(var i = 0 ; i < dirs.length -1; i++) {
                        if(dirs[i] != nextDirs[i]) {
                            sameDirectory = false;
                            break;
                        }
                    }
                 }
                if (sameDirectory) {
                    if (nextFile.name != '.DS_Store') { //FU OSX
                        var uploadFileFuture = peergos.shared.util.Futures.incomplete();
                        this.showSpinner = true;
                        if(items.length > 10) {
                            this.spinnerMessage = "preparing for upload (" + itemIndex + " of " + items.length + ")";
                        }
                        that.uploadFileFromDirectory(nextFile, currentDir, refreshDir, fromDnd, replaceParams, uploadFileFuture);
                        uploadFileFuture.thenApply(res =>
                                that.uploadFilesFromDirectory(that, refreshDir, origDir, currentDir, dirs, dirIndex,
                                items, ++itemIndex, fromDnd, replaceParams, future));
                    } else {
                        that.uploadFilesFromDirectory(that, refreshDir, origDir, currentDir, dirs, dirIndex,
                            items, ++itemIndex, fromDnd, replaceParams, future);
                    }
                } else {
                    that.traverseDirectories(origDir, origDir, null, 0, items, itemIndex, fromDnd, replaceParams, future);
                }
            } else {
                that.traverseDirectories(origDir, origDir, null, 0, items, itemIndex, fromDnd, replaceParams, future);
            }
        },
        uploadFileFromDirectory: function(file, directory, refreshDirectory, fromDnd, replaceParams, uploadFileFuture) {
            if(fromDnd) {
                let that = this;
                file.file(function(fileEntry) {
                    that.confirmAndUploadFile(fileEntry, directory, refreshDirectory, replaceParams, uploadFileFuture);
                });
            } else {
                this.confirmAndUploadFile(file, directory, refreshDirectory, replaceParams, uploadFileFuture);
            }
        },
        confirmAndUploadFile: function(file, directory, refreshDirectory, replaceParams, uploadFileFuture) {
            let that = this;
            this.context.getByPath(directory).thenApply(function(updatedDirOpt){
                let updatedDir = updatedDirOpt.get();
                updatedDir.hasChild(file.name, that.context.crypto.hasher, that.context.network)
                    .thenApply(function(alreadyExists){
                        if(alreadyExists) {
                            if (replaceParams.applyReplaceToAll) {
                                if(replaceParams.replaceFile) {
                                    that.uploadOrReplaceFile(file, directory, refreshDirectory, true, replaceParams, uploadFileFuture)
                                } else {
                                    uploadFileFuture.complete(true);
                                }
                            } else {
                                that.confirmReplaceFile(file,
                                (applyToAll) => {
                                    replaceParams.applyReplaceToAll = applyToAll;
                                    replaceParams.replaceFile = false;
                                    uploadFileFuture.complete(true);
                                 },
                                (applyToAll) => {
                                    replaceParams.applyReplaceToAll = applyToAll;
                                    replaceParams.replaceFile = true;
                                    that.uploadOrReplaceFile(file, directory, refreshDirectory, true, replaceParams, uploadFileFuture)
                                 }
                                );
                            }
                        } else {
                            that.uploadOrReplaceFile(file, directory, refreshDirectory, false, replaceParams, uploadFileFuture);
                        }
                });
            });
        },
        confirmReplaceFile: function(file, cancelFn, replaceFn) {
            this.showSpinner = false;
            this.replace_message='File: "' + file.name + '" already exists in this location. Do you wish to replace it?';
            this.replace_body='';
            this.replace_consumer_cancel_func = cancelFn;
            this.replace_consumer_func = replaceFn;
            this.replace_showApplyAll = true;
            this.showReplace = true;
        },
        uploadOrReplaceFile: function(file, directory, refreshDirectory, overwriteExisting, replaceParams, uploadFileFuture) {
            var fileStore = {
                file : file,
                directory : directory,
                refreshDirectory : refreshDirectory,
                overwriteExisting : overwriteExisting
            };
            replaceParams.fileInfoStore.push(fileStore);
            uploadFileFuture.complete(true);
        },
        uploadFileFromFileInfo: function(fileInfo) {
            var future = peergos.shared.util.Futures.incomplete();

            let directory = fileInfo.directory;
            let file = fileInfo.file;
            let refreshDirectory = fileInfo.refreshDirectory;
            var thumbnailAllocation = Math.min(100000, file.size / 10);
            var resultingSize = file.size + thumbnailAllocation;
            var progress = {
                show:true,
                title:"Encrypting and uploading " + file.name,
                done:0,
                max:resultingSize
            };
            var that = this;

            that.progressMonitors.push(progress);
            this.uploadFileJS(file, directory, refreshDirectory, fileInfo.overwriteExisting, progress, future);
            return future;
        },
        uploadFileJS: function(file, directory, refreshDirectory, overwriteExisting, progress, future) {

            var updateProgressBar = function(len){
                progress.done += len.value_0;
                //that.progressMonitors.sort(function(a, b) {
                //  return Math.floor(b.done / b.max) - Math.floor(a.done / a.max);
                //});
                if (progress.done >= progress.max) {
                    progress.show = false;
                }
            };

            var reader = new browserio.JSFileReader(file);
            var java_reader = new peergos.shared.user.fs.BrowserFileReader(reader);
            let that = this;
            let context = this.getContext();
            context.getByPath(directory).thenApply(function(updatedDirOpt){
                updatedDirOpt.get().uploadFileJS(file.name, java_reader, (file.size - (file.size % Math.pow(2, 32)))/Math.pow(2, 32), file.size,
                    overwriteExisting, overwriteExisting ? true : false, context.network, context.crypto, updateProgressBar,
                    context.getTransactionService()
                ).thenApply(function(res) {
                    var thumbnailAllocation = Math.min(100000, file.size / 10);
                    updateProgressBar({ value_0: thumbnailAllocation});
                    console.log("uploaded file:" + file.name + " in dir: " + directory);
                    if (refreshDirectory) {
                        that.showSpinner = true;
                        that.currentDir = res;
                        that.updateFiles();
                    }
                    that.updateUsage();
                    future.complete(true);
                }).exceptionally(function(throwable) {
                    progress.show = false;
                    that.errorTitle = 'Error uploading file: ' + file.name;
                    that.errorBody = throwable.getMessage();
                    that.showError = true;
                    that.updateUsage();
                    future.complete(false);
                })
            });
        },
        toggleUserMenu: function() {
            this.showSettingsMenu = !this.showSettingsMenu;
        },

        toggleFeedbackForm: function() { 
            this.showFeedbackForm = !this.showFeedbackForm;
        },

        popConversation: function(msgId) {
            if (msgId != null) {
                for (var i=0; i < this.conversationMonitors.length; i++ ) {
                    let currentMessage = this.conversationMonitors[i];
                    if(currentMessage.id == msgId) {
                        this.conversationMonitors.splice(i, 1);
                        break;
                    }
                }
            }
        },
        getMessage: function(msgId) {
            if (msgId != null) {
                //linear scan
                for (var i=0; i < this.messageMonitors.length; i++ ) {
                    let currentMessage = this.messageMonitors[i];
                    if(currentMessage.id == msgId) {
                        return this.messageMonitors[i];
                    }
                }
            }
            return null;
        },
        sendFeedback: function(contents) {
            this.showSpinner = true;
            let that = this;
            var maxContextSize = peergos.shared.user.ServerMessage.MAX_CONTENT_SIZE;
            var trimmedContents = contents.length > maxContextSize ? contents.substring(0, maxContextSize) : contents;
            this.context.sendFeedback(trimmedContents)
                .thenApply(function(res) {
                    that.showSpinner = false;
                    if (res) {
                        console.log("Feedback submitted!");
                        that.closeFeedbackForm(null, false);
                    } else {
                        that.errorTitle = 'Error sending feedback';
                        that.errorBody = "";
                        that.showError = true;
                    }
            }).exceptionally(function(throwable) {
                that.errorTitle = 'Error sending feedback';
                that.errorBody = throwable.getMessage();
                that.showError = true;
                that.showSpinner = false;
            });
        },

        sendMessage: function(msgId, contents) {
            let that = this;
            let message = this.getMessage(msgId);
            if (message != null) {
                this.showSpinner = true;
                var maxContextSize = peergos.shared.user.ServerMessage.MAX_CONTENT_SIZE;
                var trimmedContents = contents.length > maxContextSize ? contents.substring(0, maxContextSize) : contents;
                this.context.sendReply(message.msg, trimmedContents)
                    .thenApply(function(res) {
                        that.showSpinner = false;
                        if (res) {
                            console.log("message sent!");
                            that.closeFeedbackForm(msgId, true);
                        } else {
                            that.errorTitle = 'Error sending message';
                            that.errorBody = "";
                            that.showError = true;
                        }
                }).exceptionally(function(throwable) {
                    that.errorTitle = 'Error sending message';
                    that.errorBody = throwable.getMessage();
                    that.showError = true;
                    that.showSpinner = false;
                });
            }
        },

        closeFeedbackForm: function(msgId, submitted) {
            let submittedMsgId = submitted ? msgId : null;
            this.showFeedbackForm = false;
            this.messageId = null;
            this.popConversation(submittedMsgId);
        },

        loadMessageThread: function(msgId) {
            let messages = [];
            if (msgId == null) {
                return messages;
            }
            var finished = false;
            while (!finished) {
                let message = this.getMessage(msgId);
                if (message == null) {
                    break;
                }
                messages.push({id: message.id, sendTime: message.sendTime,
                    contents: message.contents, from: message.from, visible: false});
                if (message.previousMessageId == null || message.previousMessageId >= msgId) {
                    finished = true;
                }
                msgId = message.previousMessageId;
            }
            return messages.reverse();
        },

        replyToMessage: function(msgId) {
            if (this.showFeedbackForm) {
                return;
            }
            this.messageId = msgId;
            this.showFeedbackForm = true;
        },

        dismissMessage: function(msgId) {
            if (this.showFeedbackForm) {
                return;
            }
            this.messageId = null;
            if (msgId != null) {
                let message = this.getMessage(msgId);
                if (message != null) {
                     let that = this;
                     this.showSpinner = true;
                     this.context.dismissMessage(message.msg).thenApply(res => {
                        this.showSpinner = false;
                        if (res) {
                            console.log("acknowledgement sent!");
                            that.popConversation(msgId);
                        } else {
                           that.errorTitle = 'Error acknowledging message';
                           that.errorBody = "";
                           that.showError = true;
                        }
                     }).exceptionally(function(throwable) {
                           that.errorTitle = 'Error acknowledging message';
                           that.errorBody = throwable.getMessage();
                           that.showError = true;
                           that.showSpinner = false;
                    });
                }
            }
        },

        toggleUploadMenu: function() {
            this.showUploadMenu = !this.showUploadMenu;
        },

        showChangePassword: function() {
            this.toggleUserMenu();
            this.showPassword = true;
        },

        showViewAccount: function() {
            this.toggleUserMenu();
            this.showAccount = true;
        },

        showProfile: function(showEditForm) {
            if(showEditForm) {
                this.toggleUserMenu();
            } else {
                this.closeMenu();
            }
            let username = showEditForm ? this.context.username : this.selectedFiles[0].getOwnerName();
            this.displayProfile(username, showEditForm);
        },
        displayProfile: function(username, showEditForm) {
            this.showSpinner = true;
            let that = this;
            let context = this.context;
            peergos.shared.user.ProfilePaths.getProfile(username, context).thenApply(profile => {
                var base64Image = "";
                if (profile.profilePhoto.isPresent()) {
                    var str = "";
                    let data = profile.profilePhoto.get();
                    for (let i = 0; i < data.length; i++) {
                        str = str + String.fromCharCode(data[i] & 0xff);
                    }
                    if (data.byteLength > 0) {
                        base64Image = "data:image/png;base64," + window.btoa(str);
                    }
                }
                that.profile = {
                    firstName: profile.firstName.isPresent() ? profile.firstName.get() : "",
                    lastName: profile.lastName.isPresent() ? profile.lastName.get() : "",
                    biography: profile.bio.isPresent() ? profile.bio.get() : "",
                    primaryPhone: profile.phone.isPresent() ? profile.phone.get() : "",
                    primaryEmail: profile.email.isPresent() ? profile.email.get() : "",
                    profileImage: base64Image,
                    status: profile.status.isPresent() ? profile.status.get() : "",
                    webRoot: profile.webRoot.isPresent() ? profile.webRoot.get() : ""
                };
                that.showSpinner = false;
                if (showEditForm) {
                    that.showProfileEditForm = true;
                } else {
                    that.showProfileViewForm = true;
                }
            });
        },

        showRequestStorage: function() {
            this.toggleUserMenu();
	    var that = this;
	    this.context.getPaymentProperties(false).thenApply(function(paymentProps) {
		if (paymentProps.isPaid()) {
		    that.paymentProperties = paymentProps;
		    that.showBuySpace = true;
		} else
		    that.showRequestSpace = true;
	    });
        },
        newTodoBoard: function() {
            this.toggleNav();
            let that = this;
            this.prompt_placeholder='Todo Board';
            this.prompt_message='Enter a name';
            this.prompt_value='';
            this.prompt_consumer_func = function(res) {
                if (res === null)
                    return;
                if (res == '')
                    return;
                if (!res.match(/^[a-z\d\-_\s]+$/i)) {
                    that.showMessage("Invalid name. Use only alphanumeric characters plus space, dash and underscore");
                    return;
                }
                that.newTodoBoardName = res.trim();
                this.selectedFiles = [];
                that.showTodoBoardViewer = true;
		        that.updateHistory("todo", that.getPath(), "");
            };
            this.showPrompt = true;
        },
        showCalendar: function() {
            this.toggleNav();
            this.importFile = null;
            this.importSharedEvent = false;
            this.loadCalendarAsGuest = false;
            this.showCalendarViewer = true;
	    this.updateHistory("calendar", this.getPath(), "");
        },
        logout: function() {
            this.toggleUserMenu();
            this.context = null;
	    window.location.fragment = "";
            window.location.reload();
        },

        showMessage: function(title, message) {
            this.messages.push({
                title: title,
                body: message,
                show: true
            });
        },

        showAdminPanel: function(name) {
	    const context = this.getContext()
	    if (context == null)
		return;
	    const that = this;
	    context.getAndDecodePendingSpaceRequests().thenApply(reqs => {
		that.admindata.pending = reqs.toArray([]);
		that.showAdmin = true;
	    });
        },

        showSocialView: function(name) {
            this.showSocial = true;
            this.externalChange++;
        },

        showTimelineView: function() {
            let that = this;
            if (this.showSpinner) {
                return;
            }
	    this.toggleNav();
            this.showSpinner = true;
            const ctx = this.getContext()
            ctx.getSocialFeed().thenCompose(function(socialFeed) {
		return socialFeed.update().thenApply(function(updated) {
                    that.socialFeed = updated;
                    that.showTimeline = true;
                    that.showSpinner = false;
		    that.updateHistory("timeline", that.getPath(), "");
		});
            }).exceptionally(function(throwable) {
                that.showMessage(throwable.getMessage());
                that.showSpinner = false;
            });
        },

        copy: function() {
            if (this.selectedFiles.length != 1)
                return;
            var file = this.selectedFiles[0];

            this.clipboard = {
                fileTreeNode: file,
                op: "copy"
            };
            this.closeMenu();
        },

        cut: function() {
            if (this.selectedFiles.length != 1)
                return;
            var file = this.selectedFiles[0];

            this.clipboard = {
                parent: this.currentDir,
                fileTreeNode: file,
                op: "cut"
            };
            this.closeMenu();
        },

        paste: function() {
            if (this.selectedFiles.length != 1)
                return;
            var target = this.selectedFiles[0];
            var that = this;

            if(target.isDirectory()) {
                let clipboard = this.clipboard;
                if (typeof(clipboard) ==  undefined || typeof(clipboard.op) == "undefined")
                    return;

                if(clipboard.fileTreeNode.equals(target)) {
                    return;
                }
                that.showSpinner = true;

                var context = this.getContext();
                if (clipboard.op == "cut") {
                    let name = clipboard.fileTreeNode.getFileProperties().name;
                    console.log("paste-cut "+ name + " -> "+target.getFileProperties().name);
                    let filePath = peergos.client.PathUtils.toPath(that.path, name);
                    clipboard.fileTreeNode.moveTo(target, clipboard.parent, filePath, context)
                        .thenApply(function() {
                            that.currentDirChanged();
			                that.onUpdateCompletion.push(function() {
                            that.showSpinner = false;
			            });
                    }).exceptionally(function(throwable) {
                        that.errorTitle = 'Error moving file';
                        that.errorBody = throwable.getMessage();
                        that.showError = true;
                        that.showSpinner = false;
                    });
                } else if (clipboard.op == "copy") {
                    console.log("paste-copy");
                    clipboard.fileTreeNode.copyTo(target, context)
                        .thenApply(function() {
                            that.currentDirChanged();
            			    that.onUpdateCompletion.push(function() {
			                	that.showSpinner = false;
                        });
                    }).exceptionally(function(throwable) {
                        that.errorTitle = 'Error copying file';
                        that.errorBody = throwable.getMessage();
                        that.showError = true;
                        that.showSpinner = false;
                    });
                }
                this.clipboard.op = null;
            }

            this.closeMenu();
        },
        showShareWithForProfile: function(field, fieldName) {
            let dirPath = this.getContext().username + "/.profile/";
            this.showShareWithForFile(dirPath, field, false, fieldName);
        },
        showShareWithFromApp: function(app, filename, allowReadWriteSharing, nameToDisplay) {
            let dirPath = this.getContext().username + "/.apps/" + app;
            this.showShareWithForFile(dirPath, filename, allowReadWriteSharing, nameToDisplay);
        },
        showShareWithForFile: function(dirPath, filename, allowReadWriteSharing, nameToDisplay) {
            let that = this;
            var context = this.getContext();
            this.context.getByPath(dirPath)
                .thenApply(function(dir){dir.get().getChild(filename, that.context.crypto.hasher, that.context.network).thenApply(function(child){
                    let file = child.get();
                    if (file == null) {
                        return;
                    }
                    that.filesToShare = [file];
                    that.parentFile = dir.ref;
                    that.pathToFile = dirPath.split('/');
                    let directoryPath = peergos.client.PathUtils.directoryToPath(that.pathToFile);
                    context.getDirectorySharingState(directoryPath).thenApply(function(updatedSharedWithState) {
                        let fileSharedWithState = updatedSharedWithState.get(file.getFileProperties().name);
                        let read_usernames = fileSharedWithState.readAccess.toArray([]);
                        let edit_usernames = fileSharedWithState.writeAccess.toArray([]);
                        that.sharedWithData = {read_shared_with_users:read_usernames, edit_shared_with_users:edit_usernames};
                        that.fromApp = true;
                        that.displayName = nameToDisplay != null && nameToDisplay.length > 0 ?
                                                     nameToDisplay : file.getFileProperties().name;
                        that.allowReadWriteSharing = allowReadWriteSharing;
                        that.showShare = true;
                    });
                })});
        },

        showShareWith: function() {
            if (this.selectedFiles.length == 0)
                return;
            if (this.selectedFiles.length != 1)
                return;
            this.closeMenu();
            var file = this.selectedFiles[0];
            var filename = file.getFileProperties().name;
            let latestFile = this.files.filter(f => f.getName() == filename)[0];
            this.filesToShare = [latestFile];
            this.parentFile = this.isNotBackground ? this.currentDir : null;
            this.pathToFile = this.path;
            let fileSharedWithState = this.sharedWithState.get(filename);
            let read_usernames = fileSharedWithState.readAccess.toArray([]);
            let edit_usernames = fileSharedWithState.writeAccess.toArray([]);
            this.sharedWithData = {read_shared_with_users:read_usernames, edit_shared_with_users:edit_usernames};
            this.fromApp = false;
            this.displayName = latestFile.getFileProperties().name;
            this.allowReadWriteSharing = true;
            this.showShare = true;
        },

        setSortBy: function(prop) {
            if (this.sortBy == prop)
                this.normalSortOrder = !this.normalSortOrder;
            this.sortBy = prop;
        },

        changePassword: function(oldPassword, newPassword) {
            console.log("Changing password");
            this.showSpinner = true;
            var that = this;
            this.getContext().changePassword(oldPassword, newPassword).thenApply(function(newContext){
                this.contextUpdates++;
                this.context = newContext;
                this.showMessage("Password changed!");
                that.onUpdateCompletion.push(function() {
                    that.showSpinner = false;
                });
            }.bind(this));
        },

        deleteAccount: function(password) {
            console.log("Deleting Account");
            this.showSpinner = true;
            var that = this;
            this.getContext().deleteAccount(password).thenApply(function(result){
                if (result) {
                    that.showMessage("Account Deleted!");
                    setTimeout(function(){ that.logout(); }, 5000);
                } else {
                    that.updateFiles();
                    that.errorTitle = "Error Deleting Account";
                    that.errorBody = throwable.getMessage();
                    that.showError = true;
                    that.showSpinner = false;
                }
            }).exceptionally(function(throwable) {
                that.updateFiles();
                that.errorTitle = "Error Deleting Account";
                that.errorBody = throwable.getMessage();
                that.showError = true;
                that.showSpinner = false;
            });
        },
        changePath: function(path) {
            if(path == "/" && this.path.length == 0) {
                return; //already root
            }
            console.debug('Changing to path:'+ path);
            if (path.startsWith("/"))
                path = path.substring(1);
            this.path = path ? path.split('/') : [];
            this.showSpinner = true;
            this.updateHistory("filesystem", path, "");
        },
        downloadAll: function() {
            if (this.selectedFiles.length == 0)
                return;
            this.closeMenu();
            for (var i=0; i < this.selectedFiles.length; i++) {
                var file = this.selectedFiles[i];
                this.navigateOrDownload(file);
            }    
        },
        importICALFile: function(isSecretLink) {
            if (this.selectedFiles.length == 0)
                return;
            this.closeMenu();
            let file = this.selectedFiles[0];
            this.importCalendarFile(isSecretLink, file);
        },
        importCalendarFile: function(isSecretLink, file) {
            let props = file.getFileProperties();
            let that = this;
            let context = this.getContext();
            file.getInputStream(context.network, context.crypto, props.sizeHigh(), props.sizeLow(), function(read) {})
                .thenCompose(function(reader) {
                    var size = that.getFileSize(props);
                    var data = convertToByteArray(new Int8Array(size));
                    return reader.readIntoArray(data, 0, data.length)
                        .thenApply(function(read){
                            that.importFile = new TextDecoder().decode(data);
                            that.importSharedEvent = file.getOwnerName() != context.username;
                            that.loadCalendarAsGuest = isSecretLink;
                            that.showCalendarViewer = true;
                        });
            })
        },
        gallery: function() {
            // TODO: once we support selecting files re-enable this
            //if (this.selectedFiles.length == 0)
            //    return;
            this.closeMenu();
	    if (this.selectedFiles.length == 0)
		return;
	    var file = this.selectedFiles[0];
	    var filename = file.getName();
	    var mimeType = file.getFileProperties().mimeType;
	    console.log("Opening " + mimeType);
	    if (mimeType.startsWith("audio") ||
            mimeType.startsWith("video") ||
            mimeType.startsWith("image")) {
            var that = this;
            this.confirmView(file, () => {
    	        if (this.isSecretLink) {
                    that.showGallery = true;
                }
                that.updateHistory("gallery", that.getPath(), filename);
            });
	    } else if (mimeType === "application/vnd.peergos-todo") {
		if (this.isSecretLink) {
                    this.showTodoBoardViewer = true;
		}
		this.updateHistory("todo", this.getPath(), filename);
            } else if (mimeType === "text/plain") {
		if (this.isSecretLink) {
                    this.showCodeEditor = true;
		}
		this.updateHistory("editor", this.getPath(), filename);
	    } else if (mimeType === "application/pdf") {
	        if (this.isSecretLink) {
                    this.showPdfViewer = true;
		}
		this.updateHistory("pdf", this.getPath(), filename);
	    } else if (mimeType === "text/calendar") {
                    this.importICALFile(true);
		this.updateHistory("calender", this.getPath(), filename);
	    } else {
	        if (this.isSecretLink) {
                    this.showHexViewer = true;
		}
		this.updateHistory("hex", this.getPath(), filename);
	    }
        },

	navigateOrDownload: function(file) {
            if (this.showSpinner) // disable user input whilst refreshing
                return;
            this.closeMenu();
            if (file.isDirectory())
                this.navigateToSubdir(file.getFileProperties().name);
            else {
		var that = this;
		this.confirmDownload(file, () => {that.downloadFile(file);});
	    }
        },

        navigateOrMenu: function(event, file) {
            if (this.showSpinner) // disable user input whilst refreshing
                return;
            this.closeMenu();
            if (file.isDirectory())
                this.navigateToSubdir(file.getFileProperties().name);
            else
                this.openMenu(event, file);
        },

        navigateToSubdir: function(name) {
            this.changePath(this.getPath() + name);
        },
	getFileClass: function(file) {
	    if (file.isDirectory())
		return "dir";
	    return "file"
	},
        getFileIcon: function(file) {
            if (file.isDirectory()) {
                if (file.isUserRoot() && file.getName() == this.username)
                    return 'fa-home';
                return 'fa-folder-open';
            }
            var type = file.getFileProperties().getType();
            if (type == 'pdf')
                return 'fa-file-pdf';
            if (type == 'audio')
                return 'fa-file-audio';
            if (type == 'video')
                return 'fa-file-video';
            if (type == 'image')
                return 'fa-file-image';
            if (type == 'text')
                return 'fa-file-alt';
            if (type == 'zip')
                return 'fa-file-archive';
            if (type == 'powerpoint presentation' || type == 'presentation')
                return 'fa-file-powerpoint';
            if (type == 'word document' || type == 'text document')
                return 'fa-file-word';
            if (type == 'excel spreadsheet' || type == 'spreadsheet')
                return 'fa-file-excel';
            if (type == 'todo')
                return 'fas fa-tasks';
            if (type == 'calendar')
                return 'fa fa-calendar-alt';
            if (type == 'contact file')
                return 'fa fa-address-card';
            return 'fa-file';
        },
        getPath: function() {
            return '/'+this.path.join('/') + (this.path.length > 0 ? "/" : "");
        },

        dragStart: function(ev, treeNode) {
            console.log("dragstart");

            ev.dataTransfer.effectAllowed='move';
            var id = ev.target.id;
            ev.dataTransfer.setData("text/plain", id);
            var owner = treeNode.getOwnerName();
            var me = this.username;
            if (owner === me) {
                console.log("cut");
                this.clipboard = {
                    parent: this.currentDir,
                    fileTreeNode: treeNode,
                    op: "cut"
                };
            } else {
                console.log("copy");
                ev.dataTransfer.effectAllowed='copy';
                this.clipboard = {
                    fileTreeNode: treeNode,
                    op: "copy"
                };
            }
        },

        // DragEvent, FileTreeNode => boolean
        drop: function(ev, target) {
            console.log("drop");
            ev.preventDefault();
            var moveId = ev.dataTransfer.getData("text");
            var id = ev.currentTarget.id;
            var that = this;
            if(id != moveId && target.isDirectory()) {
                const clipboard = this.clipboard;
                if (typeof(clipboard) ==  undefined || typeof(clipboard.op) == "undefined")
                    return;
                that.showSpinner = true;
                var context = this.getContext();
                if (clipboard.op == "cut") {
        		    var name = clipboard.fileTreeNode.getFileProperties().name;
                    console.log("drop-cut " + name + " -> "+target.getFileProperties().name);
                    let filePath = peergos.client.PathUtils.toPath(that.path, name);
                    clipboard.fileTreeNode.moveTo(target, clipboard.parent, filePath, context)
                    .thenApply(function() {
                        that.currentDirChanged();
			            that.onUpdateCompletion.push(function() {
                            that.showSpinner = false;
                            that.clipboard = null;
			            });
                    }).exceptionally(function(throwable) {
                        that.errorTitle = 'Error moving file';
                        that.errorBody = throwable.getMessage();
                        that.showError = true;
                        that.showSpinner = false;
                    });
                } else if (clipboard.op == "copy") {
                    console.log("drop-copy");
                    var file = clipboard.fileTreeNode;
                    var props = file.getFileProperties();
                    file.copyTo(target, context)
                    .thenApply(function() {
                        that.currentDirChanged();
                        that.onUpdateCompletion.push(function() {
                            that.showSpinner = false;
                            that.clipboard = null;
                        });
                    }).exceptionally(function(throwable) {
                        that.errorTitle = 'Error copying file';
                        that.errorBody = throwable.getMessage();
                        that.showError = true;
                        that.showSpinner = false;
                    });
                }
            }
        },
        isProfileViewable: function() {
           try {
               if (this.currentDir.props.name != "/")
                   return false;
               if (this.selectedFiles.length != 1)
                   return false;
               return this.selectedFiles[0].isDirectory()
           } catch (err) {
               return false;
           }
        },
        openMenu: function(e, file) {
            if (this.ignoreEvent) {
                e.preventDefault();
                return;
            }

            if (this.showSpinner) {// disable user input whilst refreshing
                e.preventDefault();
                return;
            }
            if (this.getPath() == "/") {
		        this.isNotBackground = false;
		        if (file != null) {
                    this.selectedFiles = [file];
                }
                this.viewMenu = true;
                Vue.nextTick(function() {
                    var menu = document.getElementById("right-click-menu-profile");
                    if (menu != null)
                        menu.focus();
                    this.setMenu(e.y, e.x, "right-click-menu-profile")
                }.bind(this));
                e.preventDefault();
            } else {
                if(file) {
                    this.isNotBackground = true;
                    this.selectedFiles = [file];
                } else {
                    this.isNotBackground = false;
                    this.selectedFiles = [this.currentDir];
                }
                this.viewMenu = true;

                Vue.nextTick(function() {
                    var menu = document.getElementById("right-click-menu");
                    if (menu != null)
                    menu.focus();
                    this.setMenu(e.y, e.x, "right-click-menu")
                }.bind(this));
                e.preventDefault();
            }
        },
        createTextFile: function() {
            this.closeMenu();
            this.prompt_placeholder='File name';
            this.prompt_message='Enter a file name';
            this.prompt_value='';
            this.prompt_consumer_func = function(prompt_result) {
                if (prompt_result === null)
                    return;
                let fileName = prompt_result.trim();
                if (fileName === '')
                    return;
                this.uploadEmptyFile(fileName);
            }.bind(this);
            this.showPrompt = true;
        },
        uploadEmptyFile: function(filename) {
            this.showSpinner = true;
            let that = this;
            let context = this.getContext();
            let empty = peergos.shared.user.JavaScriptPoster.emptyArray();
            let reader = new peergos.shared.user.fs.AsyncReader.ArrayBacked(empty);
            this.currentDir.uploadFileJS(filename, reader, 0, 0,
                false, false, context.network, context.crypto, function(len){},
                context.getTransactionService()
            ).thenApply(function(res) {
                that.currentDir = res;
                that.updateFiles();
                that.onUpdateCompletion.push(function() {
                    that.showSpinner = false;
                });
            }).exceptionally(function(throwable) {
                that.showSpinner = false;
                that.errorTitle = 'Error creating file';
                that.errorBody = throwable.getMessage();
                that.showError = true;
            })
        },
        rename: function() {
            if (this.selectedFiles.length == 0)
                return;
            if (this.selectedFiles.length > 1)
                throw "Can't rename more than one file at once!";
            let file = this.selectedFiles[0];
            let fileProps = file.getFileProperties();
            let old_name =  fileProps.name
                this.closeMenu();
            let fileType = fileProps.isDirectory ? "directory" : "file";

            this.prompt_placeholder = 'New name';
	        this.prompt_value = old_name;
            this.prompt_message = 'Enter a new name';
            var that = this;
            this.prompt_consumer_func = function(prompt_result) {
                if (prompt_result === null)
                    return;
                if (prompt_result === old_name)
                    return;
                let newName = prompt_result.trim();
                if (newName === '')
                    return;
                if (newName === '.' || newName === '..')
                    return;
                that.showSpinner = true;
                console.log("Renaming " + old_name + "to "+ newName);
                let filePath = peergos.client.PathUtils.toPath(that.path, old_name);
                file.rename(newName, that.currentDir, filePath, that.getContext())
                    .thenApply(function(parent){
			            that.currentDir = parent;
			            that.updateFiles();
                        this.showPrompt =  false;
                        that.showSpinner = false;
                    }).exceptionally(function(throwable) {
			            that.updateFiles();
                        that.errorTitle = "Error renaming " + fileType + ": " + old_name;
                        that.errorBody = throwable.getMessage();
                        that.showError = true;
                        that.showSpinner = false;
                    });
            };
            this.showPrompt =  true;
        },

        deleteFiles: function() {
            var selectedCount = this.selectedFiles.length;
            if (selectedCount == 0)
                return;
            this.closeMenu();

            for (var i=0; i < selectedCount; i++) {
                var file = this.selectedFiles[i];
		var that = this;
		var parent = this.currentDir;
		var context = this.getContext();
                this.confirmDelete(file, () => that.deleteOne(file, parent, context));
            }
        },

	deleteOne: function(file, parent, context) {
	    let name = file.getFileProperties().name;
	    console.log("deleting: " + name);
            this.showSpinner = true;
            var that = this;
            let filePath = peergos.client.PathUtils.toPath(that.path, name);
            file.remove(parent, filePath, context)
                .thenApply(function(b){
                    that.currentDirChanged();
                    that.showSpinner = false;
		    that.updateUsage();
                }).exceptionally(function(throwable) {
                    that.errorTitle = 'Error deleting file: ' + file.getFileProperties().name;
                    that.errorBody = throwable.getMessage();
                    that.showError = true;
                    that.showSpinner = false;
		    that.updateUsage();
                });
	},

        setStyle: function(id, style) {
            var el = document.getElementById(id);
            if (el) {
                el.style.display = style;
            }
        },

        setMenu: function(top, left, menuId) {
            console.log("open menu");

            if (this.isNotBackground) {
                this.ignoreEvent = true;
            }

            var menu = document.getElementById(menuId);
            if (menu != null) {
                var largestHeight = window.innerHeight - menu.offsetHeight - 25;
                var largestWidth = window.innerWidth - menu.offsetWidth - 25;

                if (top > largestHeight) top = largestHeight;

                if (left > largestWidth) left = largestWidth;

                this.top = top + 'px';
                this.left = left + 'px';
            }
        },

        isShared: function(file) {
            if (this.currentDir == null)
                return false;
            if (this.sharedWithState == null)
                return false;
            return this.sharedWithState.isShared(file.getFileProperties().name);
        },
        closeMenu: function() {
            this.viewMenu = false;
            this.ignoreEvent = false;
        },
        toggleNav : function() {
            if (this.showSideNav) {
                  document.getElementById("sideMenu").style.width = "0";
            } else {
              document.getElementById("sideMenu").style.width = "60px";
            }
            this.showSideNav = !this.showSideNav;
        },
        formatDateTime: function(dateTime) {
            return dateTime.toString().replace('T',' ');
        }
    },
    computed: {
	usage: function() {
	    if (this.usageBytes == 0)
		return "N/A";
	    return this.convertBytesToHumanReadable(this.usageBytes);
	},
	
	sortedFiles: function() {
            if (this.files == null) {
                return [];
            }
            var sortBy = this.sortBy;
            var reverseOrder = ! this.normalSortOrder;
	        var that = this;
            return this.files.slice(0).sort(function(a, b) {
                var aVal, bVal;
                if (sortBy == null)
                    return 0;
                if (sortBy == "name") {
                    aVal = a.getFileProperties().name;
                    bVal = b.getFileProperties().name;
                } else if (sortBy == "size") {
                    aVal = that.getFileSize(a.getFileProperties());
                    bVal = that.getFileSize(b.getFileProperties());
                } else if (sortBy == "modified") {
                    aVal = a.getFileProperties().modified;
                    bVal = b.getFileProperties().modified;
                } else if (sortBy == "type") {
                    aVal = a.isDirectory();
                    bVal = b.isDirectory();
                } else
                    throw "Unknown sort type " + sortBy;
                if (reverseOrder) {
                    var tmp = aVal;
                    aVal = bVal;
                    bVal = tmp;
                    tmp = a;
                    a = b;
                    b = tmp;
                }

                if (a.isDirectory() !== b.isDirectory()) {
                    return  a.isDirectory() ? -1 : 1;
                } else {
                    if (sortBy == "name") {
                        return aVal.localeCompare(bVal, undefined, {numeric:true});
                    }else if (sortBy == "modified") {
                        return aVal.compareTo(bVal);
                    } else {
                        if (aVal < bVal) {
                            return -1;
                        } else if (aVal == bVal) {
                            return 0;
                        } else {
                            return 1;
                        }
                    }
                }
            });
        },
        isSearchable: function() {
           try {
               if (this.currentDir == null)
                   return false;
               if (this.selectedFiles.length != 1)
                   return false;
               if (!this.selectedFiles[0].isDirectory())
                    return false;
               var owner = this.currentDir.getOwnerName();
               var me = this.username;
               if (owner != me) {
                   return false;
               }
               return true;
           } catch (err) {
               return false;
           }
        },
        canOpen: function() {
           try {
               if (this.currentDir == null)
                   return false;
               if (this.selectedFiles.length != 1)
                   return false;
               return !this.selectedFiles[0].isDirectory()
           } catch (err) {
               return false;
           }
        },
        isIcsFile: function() {
           try {
               if (this.currentDir == null)
                   return false;
               if (this.selectedFiles.length != 1)
                   return false;
               return !this.selectedFiles[0].isDirectory() &&
                    this.selectedFiles[0].getFileProperties().name.toUpperCase().endsWith(".ICS");
           } catch (err) {
               return false;
           }
        },
        isWritable: function() {
            try {
                if (this.currentDir == null)
                    return false;
                return this.currentDir.isWritable();
            } catch (err) {
                return false;
            }
        },
	
	isSecretLink: function() {
	    return this.context != null && this.context.username == null;
	},
	
	isLoggedIn: function() {
	    return ! this.isSecretLink;
	},

        isNotHome: function() {
            return this.path.length > 1;
        },

        isNotMe: function() {
            if (this.currentDir == null)
                return true;

            var owner = this.currentDir.getOwnerName();
            var me = this.username;
            if (owner === me) {
                return false;
            }
            return true;
        },
        isPasteAvailable: function() {
            if (this.currentDir == null)
                return false;

            if (typeof(this.clipboard) ==  undefined || this.clipboard == null || this.clipboard.op == null || typeof(this.clipboard.op) == "undefined")
                return false;

            if (this.selectedFiles.length != 1)
                return false;
            var target = this.selectedFiles[0];

            if(this.clipboard.fileTreeNode.equals(target)) {
                return false;
            }

            return this.currentDir.isWritable() && target.isDirectory();
        },

	followernames: function() {
	    return this.social.followers.concat(this.social.friends);
	},

        username: function() {
            var context = this.getContext();
            if (context == null)
                return "";
            return context.username;
        }
    }
};
