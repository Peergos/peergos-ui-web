module.exports = {
    template: require('chat.html'),
    data: function() {
        return {
            showSpinner: false,
            conversations: [],
            messageThread: [],
            selectedConversationId: "",
            newMessageText: "",
            allConversations: new Map(),
            allMessageThreads: new Map(),
            chatTitle: "",
            pageEndIndex : 0,
            pageSize: 100,
            updatedSocialFeed: null,
            savingNewMsg: false,
            showConfirm: false,
            confirm_message: "",
            confirm_body: "",
            confirm_consumer_cancel_func: () => {},
            confirm_consumer_func: () => {},
            filterText: "",
            groupId: "",
            groupTitle: "",
            showGroupMembership: false,
            existingGroupMembers: [],
            messages: [],
            progressMonitors: [],
            showEmbeddedGallery: false,
            filesToViewInGallery: [],
            replyToMessage: null,
            attachment: null,
            emojiChooserBtn: null,
            emojiPicker: null
        }
    },
    props: ['context', 'closeChatViewer', 'friendnames', 'socialFeed','getFileIconFromFileAndType', 'displayProfile'],
    created: function() {
        let that = this;
        this.loadConversations();
        this.init();
        Vue.nextTick(function() {
            let element = document.getElementById('filter-conversations');
            element.addEventListener('keyup', function() {
                that.filterConversations();
            });
            let emojiChooserBtn = document.getElementById('emoji-chooser');
            that.emojiChooserBtn = emojiChooserBtn;
            const emojiPicker = new EmojiButton({
            	recentsCount: 16,
            	zIndex: 2000
            });
            emojiPicker.on('emoji', emoji => {
                //that.newMessageText += emoji;
            });
            that.emojiPicker = emojiPicker;
        });
    },
    methods: {
        launchEmojiPicker: function() {
            this.emojiPicker.togglePicker(this.emojiChooserBtn);
        },
        deleteAttachment: function() {
            let that = this;
            this.spinner(true);
            this.deleteFile(this.attachment.mediaItem.path).thenApply(function(res){
                that.spinner(false);
                that.attachment = null;
            });
        },
        deleteReply: function() {
            this.replyToMessage = null;
        },
        reply: function(message) {
            this.replyToMessage = message;
        },
        profile: function(conversation) {
            this.displayProfile(conversation.participants[0], false);
        },
        dndChatDrop: function(evt) {
            evt.preventDefault();
            let entries = evt.dataTransfer.items;
            if (entries.length != 1) {
                this.showMessage("Only 1 item can be dragged and dropped");
                return;
            }
            let mimeType = entries[0].type;
            if (!(mimeType.startsWith("image") || mimeType.startsWith("audio") || mimeType.startsWith("video"))) {
                this.showMessage("Only media files can be dragged and dropped");
            }
            let entry = entries[0].webkitGetAsEntry();
            if (entry.isDirectory || !entry.isFile) {
                this.showMessage("Only files can be dragged and dropped");
                return;
            }
            if (this.savingNewMsg) {
                this.showMessage("Unable to drag and drop while busy");
                return;
            }
            this.uploadFile(evt.dataTransfer.files[0]);
        },
        view: function (message) {
            this.filesToViewInGallery = [message.file];
            this.showEmbeddedGallery = true;
        },
        uploadMedia: function(mediaFile, updateProgressBar) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let reader = new browserio.JSFileReader(mediaFile);
            let java_reader = new peergos.shared.user.fs.BrowserFileReader(reader);
            if (mediaFile.size > 2147483647) {
                that.showMessage("Media file greater than 2GiB not currently supported!");
                future.complete(null);
            } else {
                let postTime = peergos.client.JsUtil.now();
                this.socialFeed.uploadMediaForPost(java_reader, mediaFile.size, postTime, updateProgressBar).thenApply(function(pair) {
                    var thumbnailAllocation = Math.min(100000, mediaFile.size / 10);
                    updateProgressBar({ value_0: thumbnailAllocation});
                    that.context.getByPath(pair.right.path).thenApply(function(fileOpt){
                        let file = fileOpt.ref;
                        future.complete({mediaItem: pair.right, mediaFile: file});
                    });
                });
            }
            return future;
        },
        addAttachment: function(evt) {
            let files = evt.target.files || evt.dataTransfer.files;
            let mediaFile = files[0];
            this.uploadFile(mediaFile);
        },
        uploadFile: function(mediaFile) {
            this.savingNewMsg = true;
            let that = this;
            var thumbnailAllocation = Math.min(100000, mediaFile.size / 10);
            var resultingSize = mediaFile.size + thumbnailAllocation;
            var progress = {
                show:true,
                title:"Encrypting and uploading " + mediaFile.name,
                done:0,
                max:resultingSize
            };
            this.progressMonitors.push(progress);
            let updateProgressBar = function(len){
                progress.done += len.value_0;
                if (progress.done >= progress.max) {
                    progress.show = false;
                }
            };
            let receiver = this.selectedConversationId;
            if (receiver == null || receiver.length == 0) {
                console.log("unexpected receiver !!!");
                that.showMessage("receiver not set - internal error");
                return;
            }
            this.uploadMedia(mediaFile, updateProgressBar).thenApply(function(mediaResponse) {
                that.attachment = mediaResponse;
                that.progressMonitors.splice(0, 1);
                document.getElementById('uploadInput').value = "";
                that.savingNewMsg = false;
            });
        },
        displayTitle: function(conversation) {
            let text = conversation.title.length > 0 ? this.truncateText(conversation.title, 15)
                        : this.truncateText(this.formatParticipants(conversation.participants), 15)
            return text;
        },
        filterConversations: function() {
            this.buildConversations();
        },
        refreshUI: function(val) {
            let that = this;
            that.spinner(true);
            if (this.updatedSocialFeed == null) {
                return false;
            }
            this.updatedSocialFeed.update().thenApply(function(updated) {
                console.log("refreshing...");
               that.updatedSocialFeed = updated;
               that.pageEndIndex = that.socialFeed.getLastSeenIndex();
               that.retrieveUnSeen(that.pageEndIndex, that.pageSize, []).thenApply(function(unseenItems) {
                   let items = that.filterSharedItems(unseenItems.reverse());
                   that.updateChats(items).thenApply(function(res) {
                       that.updateScrollPane();
                       that.spinner(false);
                   });
               }).exceptionally(function(throwable) {
                   that.showMessage(throwable.getMessage());
                   that.spinner(false);
               });

            });
        },
        updateChats: function (items) {
             let that = this;
             let future = peergos.shared.util.Futures.incomplete();
             this.context.getFiles(peergos.client.JsUtil.asList(items)).thenApply(function(pairs) {
                 let allPairs = pairs.toArray();
                 that.loadPostFiles(allPairs).thenApply(function(posts) {
                     that.updateMessageThreads(posts);
                     that.buildConversations();
                     that.buildMessageThread(that.conversations.length == 0 ? null : that.conversations[0].id);
                     future.complete(true);
                 });
             });
             return future;
        },
        createPlaceholder: function(id, body) {
            let message = {id: id, isStatusMsg: false, file: null, fileType: "",
                sender: "", hasThumbnail: false, thumbnail: ""
                , sendTime: "", contents: body, mediaFilePath: null
                , parentMessage: null, isDeleted: true};
            return message;
        },
        updateMessageThreads: function (allPosts) {
            let sortedPosts = allPosts.sort(function (a, b) {
                return a.post.postTime.compareTo(b.post.postTime);
            });
            for(var i = 0 ; i < sortedPosts.length; i++) {
                let msg = sortedPosts[i].post;
                let bodyParts = msg.body.toArray([]);
                let conversationId = msg.author == this.context.username ? bodyParts[0].inlineText() : msg.author;
                if (this.allConversations.get(conversationId) != null) {
                    let messageThread = this.allMessageThreads.get(conversationId);
                    if (messageThread == null) {
                        messageThread = [];
                    }
                    let post = sortedPosts[i];
                    let id = sortedPosts[i].path.substring(post.path.lastIndexOf('/') +1);
                    let index = messageThread.findIndex(v => v.id === id);
                    if (index== -1) {
                        let mediaFile = post.mediaFile;
                        let mediaFilePath = post.mediaFilePath;
                        var parent = null;
                        let parentId = msg.parent.ref == null ? null : msg.parent.ref.path.substring(msg.parent.ref.path.lastIndexOf('/') +1);
                        if (parentId != null) {
                            let parentIndex = messageThread.findIndex(v => v.id === parentId);
                            if (parentIndex > -1) {
                                parent =  messageThread[parentIndex];
                            } else {
                                parent = this.createPlaceholder(parentId, "[message deleted]");
                            }
                        }
                        let message = this.createMessage(id, msg, mediaFile, mediaFilePath, parent);
                        messageThread.push(message);
                    }
                    this.allMessageThreads.set(conversationId, messageThread);
                }
            }
        },
        updateScrollPane: function(val) {
           Vue.nextTick(function() {
               let scrollArea = document.getElementById("message-scroll-area");
               scrollArea.scrollTop = scrollArea.scrollHeight;
           });
        },
        spinner: function(val) {
            this.showSpinner = val;
        },
        init: function() {
            var that = this;
            this.spinner(true);
            let feed = this.updatedSocialFeed == null ? this.socialFeed : this.updatedSocialFeed;
            feed.update().thenApply(function(updated) {
               that.updatedSocialFeed = updated;
               that.pageEndIndex = that.socialFeed.getLastSeenIndex();
               that.retrieveUnSeen(that.pageEndIndex, that.pageSize, []).thenApply(function(unseenItems) {
                   let startIndex = 0;
                   that.retrieveResults(startIndex, that.pageEndIndex, []).thenApply(function(additionalItems) {
                       that.pageEndIndex = that.pageEndIndex - additionalItems.length;
                       let items = that.filterSharedItems(unseenItems.reverse().concat(additionalItems.reverse()));
                       that.buildChats(items).thenApply(function(res) {
                          that.updateScrollPane();
                           that.spinner(false);
                       });
                   }).exceptionally(function(throwable) {
                       that.showMessage(throwable.getMessage());
                       that.spinner(false);
                   });
               }).exceptionally(function(throwable) {
                   that.showMessage(throwable.getMessage());
                   that.spinner(false);
               });
            });
        },
        retrieveUnSeen: function(startIndex, requestSize, results) {
            var future = peergos.shared.util.Futures.incomplete();
            this.retrieveUnSeenWithFuture(startIndex, requestSize, results, future);
            return future;
        },
        retrieveUnSeenWithFuture: function(startIndex, requestSize, results, future) {
            if (! this.socialFeed.hasUnseen() ) {
                future.complete(results);
            } else {
                var ctx = this.context;
                let that = this;
                this.socialFeed.getShared(startIndex, startIndex + requestSize, ctx.crypto, ctx.network).thenApply(function(items) {
                    let allEntries = items.toArray();
                    let newIndex = startIndex + allEntries.length;
                    that.socialFeed.setLastSeenIndex(newIndex).thenApply(function(res) {
                        that.retrieveUnSeenWithFuture(newIndex, requestSize, results.concat(allEntries), future);
                    }).exceptionally(function(throwable) {
                        that.showMessage(throwable.getMessage());
                        that.spinner(false);
                    });
                }).exceptionally(function(throwable) {
                    that.showMessage(throwable.getMessage());
                    that.spinner(false);
                });
            }
            return future;
        },
        retrieveResults: function(startIndex, endIndex) {
            var future = peergos.shared.util.Futures.incomplete();
            if(startIndex < 0 || startIndex >= endIndex) {
                future.complete([]);
                return future;
            }
            var ctx = this.context;
            this.socialFeed.getShared(startIndex, endIndex, ctx.crypto, ctx.network).thenApply(function(items) {
                future.complete(items.toArray());
            }).exceptionally(function(throwable) {
                that.showMessage(throwable.getMessage());
                that.spinner(false);
            });
            return future;
        },
        filterSharedItems: function(items) {
            let filteredSharedItems = [];
            for(var i=0; i < items.length; i++) {
                let currentSharedItem = items[i];
                if (currentSharedItem.path.includes("/.posts/")) {
                    filteredSharedItems.push(currentSharedItem);
                }
            }
            return filteredSharedItems;
        },
        close: function () {
            if (this.emojiPicker != null) {
                try {
                this.emojiPicker.hidePicker();
                } catch(ex) {
                    //just means it is not open
                }
            }
            this.closeChatViewer();
        },
        truncateText: function(text, length) {
            return  text.length > length ? text.substring(0,length -3) + '...' : text;
        },
        formatDateTime: function(dateTime) {
            if (dateTime == "") {
                return "";
            }
            let date = new Date(dateTime.toString());
            let localStr =  date.toISOString().replace('T',' ');
            let withoutMS = localStr.substring(0, localStr.indexOf('.'));
            return withoutMS;
        },
        uuidv4: function() {
          let uuid = ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
          ).split("-").join("");
          return uuid.substring(0, 16);
        },
        getExistingConversationTitles: function() {
            let existingGroups = [];
            this.conversations.forEach(conversation => {
                if (conversation.title.length > 0) {
                    existingGroups.push(conversation.title);
                } else {
                    existingGroups.push(conversation.id);//todo fixme this is not a good idea
                }
            });
            return existingGroups;
        },
        //todo currently not saved!
        addStatusMessage: function(conversationId, contents) {
            let currentThread = this.allMessageThreads.get(conversationId);
            let id = this.uuidv4();
            let now = peergos.client.JsUtil.now();
            let message = {id: id, isStatusMsg: true, sender: null, hasThumbnail: false,
                sendTime: now.toString(), contents: contents, isDeleted: false};
            if (currentThread == null) {
                this.allMessageThreads.set(conversationId, [message]);
            } else {
                currentThread.push(message);
            }
        },
        extractAddedParticipants: function(origParticipants, updatedParticipants) {
            let addedParticipants = [];
            updatedParticipants.forEach(member => {
                let index = origParticipants.findIndex(v => v === member);
                if (index == -1) {
                    addedParticipants.push(member);
                }
            });
            return addedParticipants;
        },
        extractRemovedParticipants: function(origParticipants, updatedParticipants) {
            let removedParticipants = [];
            let copyOfOrigParticipants = origParticipants.slice();
            copyOfOrigParticipants.forEach(member => {
                let index = updatedParticipants.findIndex(v => v === member);
                if (index == -1) {
                    removedParticipants.push(member);
                }
            });
            return removedParticipants;
        },
        updatedGroupMembership: function(groupId, updatedGroupTitle, updatedMembers) {
            let conversationId = groupId == "" ? this.uuidv4() : groupId;
            if (groupId == "") {
                let title = updatedGroupTitle;
                let item = {id: conversationId, title: title, participants: updatedMembers};
                this.allConversations.set(conversationId, item);
                this.addStatusMessage(conversationId, "This is the beginning of the group conversation");
            } else {
                let conversation = this.allConversations.get(conversationId);
                if (conversation != null) {
                    conversation.title = updatedGroupTitle;
                    let added = this.extractAddedParticipants(conversation.participants, updatedMembers);
                    if (added.length > 0) {
                        this.addStatusMessage(conversationId, "The following participant(s) have been added: " + added.join(','));
                    }
                    let removed = this.extractRemovedParticipants(conversation.participants, updatedMembers);
                    if (removed.length > 0) {
                        this.addStatusMessage(conversationId, "The following participant(s) have been removed: " + removed.join(','));
                    }
                    conversation.participants = updatedMembers.slice();
                }
            }
            this.buildConversations();
            this.buildMessageThread(conversationId);
        },
        newConversation: function() {
            this.groupId = "";
            this.groupTitle = "New Group";
            this.friendNames = this.friendnames;
            this.messages = this.messages;
            this.existingGroups = this.getExistingConversationTitles();
            this.showGroupMembership = true;
        },
        editConversation: function() {
            let conversation = this.allConversations.get(this.selectedConversationId);
            if (conversation != null) {
                this.groupId = this.selectedConversationId;
                this.groupTitle = conversation.title;
                this.friendNames = this.friendnames;
                this.messages = this.messages;
                this.existingGroups = this.getExistingConversationTitles();
                this.showGroupMembership = true;
            }
        },
        deleteConversation: function(conversation) {
            this.allConversations.delete(conversation.id);
            this.buildConversations();
            this.buildMessageThread(this.conversations.length == 0 ? null : this.conversations[0].id);
        },
        confirmDeleteMessage: function(deleteMessageFunction, cancelFunction) {
            this.confirm_message='Are you sure you want to delete the message?';
            this.confirm_body='';
            this.confirm_consumer_cancel_func = cancelFunction;
            this.confirm_consumer_func = deleteMessageFunction;
            this.showConfirm = true;
        },
        deleteMessage: function(message) {
            let that = this;
            if (message.sender != this.context.username) {
                return;
            }
            this.confirmDeleteMessage(
                () => { that.showConfirm = false;
                    that.deleteChatMessage(message);
                },
                () => { that.showConfirm = false;}
            );
        },
        extractMessagePath: function(message) {
            let sendTime = message.sendTime;
            var month = sendTime.substring(5,7);
            if (month.charAt(0) == '0') {
                month = month.charAt(1);
            }
            let directory = message.sender +"/.posts/" + sendTime.substring(0,4) + "/" + month + "/" + message.id;
            return directory;
        },
        convertToPath: function(dir) {
            let dirWithoutLeadingSlash = dir.startsWith("/") ? dir.substring(1) : dir;
            return peergos.client.PathUtils.directoryToPath(dirWithoutLeadingSlash.split('/'));
        },
        deleteChatMessage: function(message) {
            let that = this;
            this.spinner(true);
            this.deleteFile(this.extractMessagePath(message)).thenApply(function(res){
                that.deleteFile(message.mediaFilePath).thenApply(function(res2){
                    that.spinner(false);
                    if (res) {
                        let currentMessageThread = that.allMessageThreads.get(that.selectedConversationId);
                        let index = currentMessageThread.findIndex(v => v.id === message.id);
                        if (index > -1) {
                            currentMessageThread.splice(index, 1);
                            that.refresh();
                        }
                    }
                });
            });
        },
        deleteFile: function(filePathStr) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            if (filePathStr == null) {
                future.complete(true);
            } else {
                let filePath = this.convertToPath(filePathStr);
                let parentPath = filePathStr.substring(0, filePathStr.lastIndexOf('/'));
                this.context.getByPath(parentPath).thenApply(function(optParent){
                    that.context.getByPath(filePathStr).thenApply(function(updatedFileOpt){
                        if (updatedFileOpt.ref != null) {
                            updatedFileOpt.ref.remove(optParent.get(), filePath, that.context).thenApply(function(b){
                                future.complete(true);
                            }).exceptionally(function(throwable) {
                                that.showMessage("error deleting message");
                                future.complete(false);
                            });
                        } else {
                            future.complete(true);
                        }
                    });
                }).exceptionally(function(throwable) {
                    that.showMessage("error deleting chat message");
                    future.complete(false);
                });
            }
            return future;
        },
        refresh: function () {
            this.buildConversations();
            this.updateScrollPane();
        },
        selectConversation: function (conversation) {
            this.buildMessageThread(conversation.id);
        },
        isConversationSelected: function (conversation) {
            return this.selectedConversationId == conversation.id;
        },
        extractOwnerFromPath: function(path) {
            let pathWithoutLeadingSlash = path.startsWith("/") ? path.substring(1) : path;
            return pathWithoutLeadingSlash.substring(0, pathWithoutLeadingSlash.indexOf("/"));
        },
        reduceLoadingMediaPosts: function(refs, index, accumulator, future) {
            let that = this;
            if (index == refs.length) {
                future.complete(accumulator);
            } else {
                let ref = refs[index];
                let owner = this.extractOwnerFromPath(ref.path);
                this.context.network.getFile(ref.cap, owner).thenApply(optFile => {
                    let mediaFile = optFile.ref;
                    if (mediaFile != null) {
                        accumulator = accumulator.concat({path: ref.path, postPath: ref.postPath, file: mediaFile});
                    }
                    that.reduceLoadingMediaPosts(refs, ++index, accumulator, future);
                })
            }
        },
        loadMediaPosts: function(sharedPosts) {
            let future = peergos.shared.util.Futures.incomplete();
            let refs = [];
            for(var i = 0; i < sharedPosts.length; i++) {
                let post = sharedPosts[i].post;
                let postPath = sharedPosts[i].path;
                if (post != null) {
                    let bodyParts = post.body.toArray([]);
                    if (bodyParts.length == 3) {
                        let mediaRef = bodyParts[2].reference().ref;
                        refs.push({postPath: postPath, cap: mediaRef.cap, path: mediaRef.path});
                    }
                }
            }
            this.reduceLoadingMediaPosts(refs, 0, [], future);
            return future;
        },
        getFileSize: function(props) {
                var low = props.sizeLow();
                if (low < 0) low = low + Math.pow(2, 32);
                return low + (props.sizeHigh() * Math.pow(2, 32));
        },
        loadPost: function(file, future) {
            let that = this;
            const props = file.getFileProperties();
            file.getInputStream(this.context.network, this.context.crypto, props.sizeHigh(), props.sizeLow(), function(read){})
                .thenApply(function(reader) {
                    var size = that.getFileSize(props);
                    var data = convertToByteArray(new Int8Array(size));
                    reader.readIntoArray(data, 0, data.length).thenApply(function(read){
                        let socialPost = peergos.shared.util.Serialize.parse(data, c => peergos.shared.social.SocialPost.fromCbor(c));
                        future.complete(socialPost);
                    });
            }).exceptionally(function(throwable) {
                that.showMessage("error loading post");
                future.complete(null);
            });
        },
        loadFile: function(file) {
            let future = peergos.shared.util.Futures.incomplete();
            this.loadPost(file, future);
            return future;
        },
        reduceLoadingAllFiles: function(pairs, index, accumulator, future) {
            let that = this;
            if (index == pairs.length) {
                future.complete(accumulator);
            } else {
                let currentPair = pairs[index];
                that.loadFile(currentPair.right).thenApply(contents => {
                    accumulator = accumulator.concat({path: currentPair.left.path, post: contents});
                    that.reduceLoadingAllFiles(pairs, ++index, accumulator, future);
                });
            }
        },
        loadPostFiles: function(pairs) {
            let future = peergos.shared.util.Futures.incomplete();
            this.reduceLoadingAllFiles(pairs, 0, [], future);
            let that = this;
            let future2 = peergos.shared.util.Futures.incomplete();
            future.thenApply(allPosts => {
                that.loadMediaPosts(allPosts).thenApply(function(mediaFiles) {
                    mediaFiles.forEach(mediaFile => {
                        let index = allPosts.findIndex(v => v.path == mediaFile.postPath);
                        if (index > -1) {
                            let post = allPosts[index];
                            post.mediaFile = mediaFile.file;
                            post.mediaFilePath = mediaFile.path;
                        }
                    });
                    future2.complete(allPosts);
                });
            });
            return future2;
        },
        buildChats: function (items) {
             let that = this;
             let future = peergos.shared.util.Futures.incomplete();
             this.context.getFiles(peergos.client.JsUtil.asList(items)).thenApply(function(pairs) {
                 let allPairs = pairs.toArray();
                 that.loadPostFiles(allPairs).thenApply(function(posts) {
                     that.updateMessageThreads(posts);
                     that.buildConversations();
                     that.buildMessageThread(that.conversations.length == 0 ? null : that.conversations[0].id);
                     future.complete(true);
                 });
             });
             return future;
        },
        toBase64Image: function(data) {
            var str = "";
            for (let i = 0; i < data.length; i++) {
                str = str + String.fromCharCode(data[i] & 0xff);
            }
            if (data.byteLength > 0) {
                return "data:image/png;base64," + window.btoa(str);
            }
            return "";
        },
        reduceLoadAllConversationIcons: function(index, items) {
            let that = this;
            if (index < items.length) {
                let item = items[index];
                //todo should not be using id!
                peergos.shared.user.ProfilePaths.getProfilePhoto(item.id, this.context).thenApply(result => {
                    if (result.ref != null) {
                        Vue.nextTick(function() {
                            item.profileImage = that.toBase64Image(result.ref);
                        });
                    }
                    that.reduceLoadAllConversationIconsAsync(index+1, items);
                }).exceptionally(function(throwable) {
                    that.reduceLoadAllConversationIconsAsync(index+1, items);
                });
            }
        },
        reduceLoadAllConversationIconsAsync: function(index, items) {
            let that = this;
            let func = function(){
                that.reduceLoadAllConversationIcons(index, items);
            };
            //window.setTimeout(func, 1000);
            Vue.nextTick(func);
        },
        loadConversationIcons: function(items) {
            this.reduceLoadAllConversationIconsAsync(0, items);
        },
        loadConversations: function() {
            let that = this;
            let items = [];
            for(var i = 0; i < this.friendnames.length; i++) {
                let name = this.friendnames[i];
                let id = this.uuidv4();
                //todo should use id rather than name!
                let item = {id: name, title: "", participants: [name]};
                items.push(item);
                that.allConversations.set(item.id, item);
            }
            Vue.nextTick(function() {
                that.loadConversationIcons(items);
            });
        },
        buildConversations: function() {
            let conversationList = [];
            //todo should do this based on new messages - not the whole conversation list!!
            this.allConversations.forEach((val, key) => {
                let filterText = this.filterText.toLowerCase();
                let index = this.filterText.length == 0 ? 0 : val.participants.findIndex(v => v.indexOf(filterText) > -1);
                if (index > -1) {
                    let messageThread = this.allMessageThreads.get(key);
                    if (messageThread != null && messageThread.length > 0) {
                        let latestMessage = messageThread[messageThread.length -1];
                        val.blurb = latestMessage.contents;
                        val.lastModified = latestMessage.sendTime;
                    } else {
                        val.blurb = "";
                        val.lastModified = "";
                    }
                    conversationList.push(val);
                }
            });
            conversationList.sort(function(aVal, bVal){
                return bVal.lastModified.localeCompare(aVal.lastModified)
            });

            this.conversations = conversationList;
        },
        formatParticipants: function (participants) {
            let list = participants.join(',');
            return list;
        },
        buildMessageThread: function (conversationId) {
            if (conversationId != null) {
                let conversation = this.allConversations.get(conversationId);
                let participants = conversation.participants.length == 0 ? "" : " - " + this.truncateText(this.formatParticipants(conversation.participants), 20);
                this.chatTitle = conversation.title.length > 0 ? this.truncateText(conversation.title, 20)
                                + participants
                                : "";
                this.selectedConversationId = conversationId;
                let currentMessageThread = this.allMessageThreads.get(conversationId);
                if (currentMessageThread != null) {
                    this.messageThread = currentMessageThread;
                } else {
                    this.messageThread = [];
                }
            } else {
                this.chatTitle = "";
                this.messageThread = [];
            }
        },
        /*
        //https://stackoverflow.com/questions/59918250/how-to-replace-all-emoji-in-string-to-unicode-js/59918364#59918364
        encodeEmojiInText: function(text) {
            const rex = /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/ug;
            return text.replace(rex, match => `[e-${match.codePointAt(0).toString(16)}]`);
        },
        decodeEmojiInText: function(text) {
            return text.replace(/\[e-([0-9a-fA-F]+)\]/g, (match, hex) =>
                String.fromCodePoint(Number.parseInt(hex, 16))
            );
        },*/
        sendMessage: function() {
            let that = this;
            let text = this.newMessageText;
            if (this.savingNewMsg || this.selectedConversationId.length == 0 ) {
                return;
            }
            that.savingNewMsg = true;
            let receiver = this.selectedConversationId;
            let resharingType = peergos.shared.social.SocialPost.Resharing.Friends;
            let attachment = this.attachment;
            if (this.replyToMessage != null) {
                this.sendReplyMessage(this.replyToMessage, receiver, receiver, text, resharingType, attachment);
            } else {
                this.newMessage(receiver, receiver, text, resharingType, attachment);
            }
        },
        newMessage: function(receiver, receiver, text, resharingType, attachment) {
            let that = this;
            let bodyItems = [new peergos.shared.social.SocialPost.Content.Text(receiver)];
            bodyItems.push(new peergos.shared.social.SocialPost.Content.Text(text));
            if (attachment != null) {
                bodyItems.push(new peergos.shared.social.SocialPost.Content.Reference(attachment.mediaItem));
                let body = peergos.client.JsUtil.asList(bodyItems);
                let socialPost = peergos.shared.social.SocialPost.createInitialPost(that.context.username, body, resharingType);
                that.savePost(socialPost, receiver, attachment.mediaFile, attachment.mediaItem.path, null);
            } else {
                let body = peergos.client.JsUtil.asList(bodyItems);
                let socialPost = peergos.shared.social.SocialPost.createInitialPost(that.context.username, body, resharingType);
                this.savePost(socialPost, receiver, null, null, null);
            }
        },
        sendReplyMessage: function(replyToMessage, receiver, receiver, text, resharingType, attachment) {
            let that = this;
            let path = this.extractMessagePath(replyToMessage);
            this.generateRef(path).thenApply(function(parent) {
                if (parent == null) {
                    that.showMessage("Original message not found");
                } else {
                    let bodyItems = [new peergos.shared.social.SocialPost.Content.Text(receiver)];
                    bodyItems.push(new peergos.shared.social.SocialPost.Content.Text(text));
                    if (attachment != null) {
                        bodyItems.push(new peergos.shared.social.SocialPost.Content.Reference(attachment.mediaItem));
                        let body = peergos.client.JsUtil.asList(bodyItems);
                        let socialPost = peergos.shared.social.SocialPost.createComment(parent, resharingType, that.context.username, body);
                        that.savePost(socialPost, receiver, attachment.mediaFile, attachment.mediaItem.path, replyToMessage);
                    } else {
                        let body = peergos.client.JsUtil.asList(bodyItems);
                        let socialPost = peergos.shared.social.SocialPost.createComment(parent, resharingType, that.context.username, body);
                        that.savePost(socialPost, receiver, null, null, replyToMessage);
                    }
                }
            });
        },
        generateRef: function(path) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            this.context.getByPath(path).thenApply(function(fileOpt){
                let file = fileOpt.ref;
                if (file == null) {
                    future.complete(null);
                } else {
                    that.loadFile(file).thenApply(function(socialPost){
                        socialPost.contentHash(that.context.crypto.hasher).thenApply(function(hash) {
                            let ref = new peergos.shared.social.SocialPost.Ref(path, file.readOnlyPointer(), hash);
                            future.complete(ref);
                        });
                    });
                }
            });
            return future;
        },
        savePost: function(socialPost, receiver, mediaFile, mediaFilePath, parentMessage) {
            let that = this;
            that.spinner(true);
           this.socialFeed.createNewPost(socialPost).thenApply(function(result) {
                let id = result.right.props.name;
               that.context.shareReadAccessWith(result.left, peergos.client.JsUtil.asSet([receiver])).thenApply(function(b) {
                       that.spinner(false);
                        let message = that.createMessage(id, socialPost, mediaFile, mediaFilePath, parentMessage);
                        let currentThread = that.allMessageThreads.get(receiver);
                        if (currentThread == null) {
                            that.allMessageThreads.set(receiver, [message]);
                        } else {
                            currentThread.push(message);
                        }
                        that.newMessageText = "";
                        that.buildMessageThread(receiver);
                        that.refresh();
                        that.savingNewMsg = false;
                        that.replyToMessage = null;
                        that.attachment = null;
                   }).exceptionally(function(err) {
                        that.spinner(false);
                        that.showMessage(err.getMessage());
                        that.savingNewMsg = false;
                        that.replyToMessage = null;
                        that.attachment = null;
               });
            }).exceptionally(function(throwable) {
                that.showMessage(throwable.getMessage());
                that.spinner(false);
                that.savingNewMsg = false;
            });
        },
        createMessage: function(id, socialPost, mediaFile, mediaFilePath, parentMessage) {
            let timestamp = socialPost.postTime;
            let fileType = mediaFile == null ? "" : mediaFile.getFileProperties().getType();
            let thumbnail = (mediaFile != null && mediaFile.getFileProperties().thumbnail.ref != null) ? mediaFile.getBase64Thumbnail() : "";
            let bodyParts = socialPost.body.toArray([]);
            let contents = bodyParts[1].inlineText();
            let message = {id: id, isStatusMsg: false, file: mediaFile, fileType: fileType,
                sender: socialPost.author, hasThumbnail: thumbnail.length > 0, thumbnail: thumbnail
                , sendTime: timestamp.toString(), contents: contents, mediaFilePath: mediaFilePath
                , parentMessage: parentMessage, isDeleted: false};
            return message;
        }
    }
}
