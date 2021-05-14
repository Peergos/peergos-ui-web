module.exports = {
    template: require('chat.html'),
    data: function() {
        return {
            showSpinner: false,
            spinnerMessage: '',
            conversations: [],
            messageThread: [],
            selectedConversationId: null,
            newMessageText: "",
            allConversations: new Map(),
            allChatControllers: new Map(),
            allMessageThreads: new Map(),
            allThreadsHashToIndex: new Map(),
            chatTitle: "",
            pageStartIndex : 0,
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
            editMessage: null,
            attachment: null,
            emojiChooserBtn: null,
            emojiPicker: null,
            messenger: null,
            displayingMessages: false
        }
    },
    props: ['context', 'closeChatViewer', 'friendnames', 'socialFeed', 'socialState', 'getFileIconFromFileAndType', 'displayProfile'],
    created: function() {
        let that = this;
        this.messenger = new peergos.shared.messaging.Messenger(this.context);
        this.init();
        Vue.nextTick(function() {
            let element = document.getElementById('filter-conversations');
            element.addEventListener('keyup', function() {
                that.filterConversations();
            });

            window.addEventListener("resize", that.resizeHandler);
            that.resizeHandler();
            let emojiChooserBtn = document.getElementById('emoji-chooser');
            that.emojiChooserBtn = emojiChooserBtn;
            const emojiPicker = new EmojiButton({
            	recentsCount: 16,
            	zIndex: 2000
            });
            emojiPicker.on('emoji', emoji => {
                that.newMessageText += emoji;
            });
            that.emojiPicker = emojiPicker;
        });
    },
    methods: {
        resizeHandler: function() {
            var left = document.getElementById("chat-left-panel");
            var right = document.getElementById("dnd-chat");
            let closeConversationEl = document.getElementById('chat-back-button');
            if (this.displayingMessages) {
                left.classList.remove("chat-full-width");
                right.classList.remove("chat-hide");
                if(window.innerWidth >= 900) {
                    left.classList.remove("chat-hide");
                    right.classList.remove("chat-full-width");
                    closeConversationEl.style.display = 'none';
                } else if(window.innerWidth <= 900) {
                    left.classList.add("chat-hide");
                    right.classList.add("chat-full-width");
                    closeConversationEl.style.display = '';
                }
            } else {
                right.classList.remove("chat-full-width");
                left.classList.remove("chat-hide");
                closeConversationEl.style.display = 'none';
                if(window.innerWidth >= 900) {
                    left.classList.remove("chat-full-width");
                    right.classList.remove("chat-hide");
                } else if(window.innerWidth <= 900) {
                    left.classList.add("chat-full-width");
                    right.classList.add("chat-hide");
                }
            }
        },
        closeConversation: function (conversation) {
            this.displayingMessages = false;
            this.resizeHandler();
        },
        selectConversation: function (conversation) {
            this.displayingMessages = true;
            this.resizeHandler();
            this.buildMessageThread(conversation.id);
            this.updateScrollPane();
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
                peergos.shared.user.ProfilePaths.getProfilePhoto(item.participants[0], this.context).thenApply(result => {
                    if (result.ref != null) {
                        Vue.nextTick(function() {
                            item.profileImage = that.toBase64Image(result.ref);
                        });
                    } else {
                        item.profileImageNA = true;
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
            Vue.nextTick(func);
        },
        loadConversationIcons: function(items) {
            //todo this.reduceLoadAllConversationIconsAsync(0, items);
        },
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
            this.newMessageText = "";
        },
        reply: function(message) {
            this.replyToMessage = message;
            this.editMessage = null;
            this.focus();
        },
        deleteEdit: function() {
            this.editMessage = null;
            this.newMessageText = "";
        },
        edit: function(message) {
            this.replyToMessage = null;
            this.editMessage = message;
            this.newMessageText = message.contents;
            this.focus();
        },
        focus: function(message) {
            Vue.nextTick(function() {
                document.getElementById("message-input").focus();
            });
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
            /*
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
            });*/
        },
        displayTitle: function(conversation) {
            return this.truncateText(conversation.title, 15);
        },
        filterConversations: function() {
            this.buildConversations();
        },
        updateMessageThreads: function (allChats) {
            for(var i = 0; i < allChats.length; i++) {
                let messagePairs = allChats[i].messagePairs;
                this.updateMessageThread(allChats[i].conversationId, messagePairs);
            }
        },
        updateMessageThread: function (conversationId, messagePairs) {
            let messageThread = this.allMessageThreads.get(conversationId);
            var hashToIndex = this.allThreadsHashToIndex.get(conversationId);
            if (hashToIndex == null) {
                hashToIndex = new Map();
                this.allThreadsHashToIndex.set(conversationId, hashToIndex);
            }
            let chatController = this.allChatControllers.get(conversationId);
            for(var j = 0; j < messagePairs.length; j++) {
                let chatEnvelope = messagePairs[j].message;
                let messageHash = messagePairs[j].hash;
                let payload = chatEnvelope.payload;
                let type = payload.type().toString();
                let author = chatController.controller.getAuthorUsername(chatEnvelope);
                if (type == 'GroupState') {//type
                    if(payload.key == "title") {
                        messageThread.push(this.createStatusMessage(chatEnvelope.creationTime, "Chat name changed to " + payload.value));
                        let conversation = this.allConversations.get(conversationId);
                        conversation.title = payload.value;
                    }
                } else if(type == 'Invite') {
                    let username = chatEnvelope.payload.username;
                    messageThread.push(this.createStatusMessage(chatEnvelope.creationTime, author + " invited " + username));
                } else if(type == 'Join') {
                    let username = chatEnvelope.payload.username;
                    messageThread.push(this.createStatusMessage(chatEnvelope.creationTime, username + " joined the chat"));
                } else if(type == 'Application') {
                    hashToIndex.set(messageHash, messageThread.length);
                    messageThread.push(this.createMessage(author, chatEnvelope, payload.body.content, null, null, null));
                } else if(type == 'Edit') {
                    let messageIndex = hashToIndex.get(payload.priorVersion.toString());
                    let message = messageThread[messageIndex];
                    if (author == message.sender) {
                        message.contents = payload.content.body.content;
                        message.edited = true;
                    }
                } else if(type == 'Delete') {
                    let messageIndex = hashToIndex.get(payload.target.toString());
                    let message = messageThread[messageIndex];
                    if (author == message.sender) {
                        message.contents = "[Message Deleted]";
                        message.deleted = true;
                    }
                } else if(type == 'ReplyTo') {
                    let parentRef = payload.parent;
                    let messageIndex = hashToIndex.get(parentRef.toString());
                    let parentMessage = messageThread[messageIndex];
                    hashToIndex.set(messageHash, messageThread.length);
                    messageThread.push(this.createMessage(author, chatEnvelope, payload.content.body.content, null, null, parentMessage));
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
            this.refreshUI();
        },
        fullRefresh: function() {
            if (this.showSpinner) {
                return;
            }
            this.init();
        },
        refreshUI: function(existingChats) {
            var that = this;
            this.spinner(true);
            this.messenger.listChats().thenApply(function(chats) {
                let allChats = chats.toArray();
                that.loadChatMessages(allChats).thenApply(function(allChats) {
                    that.updateMessageThreads(allChats);
                    that.buildConversations();
                    let conversationId = null;
                    if (that.selectedConversationId != null) {
                        conversationId = that.selectedConversationId;
                    } else if(that.conversations.length > 0){
                        conversationId = that.conversations[0].id;
                    }
                    that.buildMessageThread(conversationId);
                    if (conversationId != null) {
                        that.updateScrollPane();
                    }
                    that.spinner(false);
                });
            });
        },
        generateMessageHashes: function(chatController, messages) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let messagePairs = [];
            if (messages.length == 0) {
                future.complete(messagePairs);
            } else {
                messages.forEach(message => {
                    chatController.controller.generateHash(message).thenApply(messageRef => {
                        messagePairs.push({message: message, hash: messageRef.toString()});
                        if(messagePairs.length == messages.length) {
                            future.complete(messagePairs);
                        }
                    });
                });
            }
            return future;
        },
        refreshConversation: function(conversationId) {
            var that = this;
            this.spinner(true);
            let chatController = this.allChatControllers.get(conversationId);
            that.messenger.mergeAllUpdates(chatController.controller, this.socialState).thenApply(latestController => {
                chatController.controller = latestController;
                that.getAllMessages(chatController).thenApply(messages => {
                    that.generateMessageHashes(chatController, messages).thenApply(messagePairs => {
                        that.updateMessageThread(conversationId, messagePairs);
                        that.buildConversations();
                        that.buildMessageThread(conversationId);
                        that.updateScrollPane();
                        that.spinner(false);
                    });
                });
            });
        },
        reduceGetAllMessages: function(chatController, messages, future) {
            let that = this;
            let startIndex = chatController.startIndex;
            chatController.controller.getMessages(startIndex, startIndex + 1000).thenApply(result => {
                let newMessages = result.toArray();
                chatController.startIndex += newMessages.length;
                if (newMessages.length < 1000) {
                    future.complete(messages.concat(newMessages));
                } else {
                    that.reduceGetAllMessages(chatController, messages.concat(newMessages), future);
                }
            });
        },
        getAllMessages: function(chatController) {
            let future = peergos.shared.util.Futures.incomplete();
            this.reduceGetAllMessages(chatController, [], future);
            return future;
        },
        close: function () {
            if (this.emojiPicker != null) {
                try {
                this.emojiPicker.hidePicker();
                } catch(ex) {
                    //just means it is not open
                }
            }
            window.removeEventListener("resize", this.resizeHandler);
            this.closeChatViewer();
        },
        truncateText: function(text, length) {
            return  text.length > length ? text.substring(0,length -3) + '...' : text;
        },
        formatDateTime: function(dateTime) {
            if (dateTime == "") {
                return "";
            }
            let date = new Date(dateTime.toString() + "+00:00");//adding UTC TZ in ISO_OFFSET_DATE_TIME ie 2021-12-03T10:25:30+00:00
            let formatted = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()
                + ' ' + (date.getHours() < 10 ? '0' : '') + date.getHours()
                + ':' + (date.getMinutes() < 10 ? '0' : '') + date.getMinutes()
                + ':' + (date.getSeconds() < 10 ? '0' : '') + date.getSeconds();
            return formatted;
        },
        getExistingConversationTitles: function() {
            let existingGroups = [];
            this.conversations.forEach(conversation => {
                existingGroups.push(conversation.title);
            });
            return existingGroups;
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
        updatedGroupMembership: function(conversationId, updatedGroupTitle, updatedMembers) {
            let that = this;
            let conversation = this.allConversations.get(conversationId);
            this.spinner(true);
            if (conversation == null) {
                this.spinnerMessage = "creating new chat";
                this.messenger.createChat().thenApply(function(controller){
                    let conversationId = controller.chatUuid;
                    that.allChatControllers.set(controller.chatUuid,
                        {controller: controller, owner: that.context.username, startIndex: 0});
                    let item = {id: conversationId, title: updatedGroupTitle, participants: updatedMembers};
                    if (updatedMembers.length == 1) {
                        item.profileImageNA = false;
                    }
                    that.allConversations.set(conversationId, item);
                    that.allMessageThreads.set(conversationId, []);

                    that.changeTitle(conversationId, updatedGroupTitle).thenApply(function(res1) {
                        that.inviteNewParticipants(conversationId, updatedMembers).thenApply(function(res1) {
                            that.spinnerMessage = "";
                            that.spinner(false);
                            that.refreshConversation(conversationId);
                        });
                    });
                });
            } else {
                if (updatedMembers.length == 1) {
                    conversation.profileImageNA = false;
                }
                let added = this.extractAddedParticipants(conversation.participants, updatedMembers);
                let removed = this.extractRemovedParticipants(conversation.participants, updatedMembers);
                conversation.participants = updatedMembers.slice();
                that.inviteNewParticipants(conversationId, added).thenApply(function(res1) {
                    that.unInviteParticipants(conversationId, removed).thenApply(function(res2) {
                        that.spinnerMessage = "";
                        that.spinner(false);
                        if (conversation.title != updatedGroupTitle) {
                            conversation.title = updatedGroupTitle;
                            that.changeTitle(conversationId, updatedGroupTitle).thenApply(function(res3) {
                                that.refreshConversation(conversationId);
                            });
                        } else {
                            that.refreshConversation(conversationId);
                        }
                    });
                });
            }
        },
        newConversation: function() {
            let that = this;
            that.groupId = "";
            that.groupTitle = "New Group";
            that.friendNames = that.friendnames;
            that.messages = that.messages;
            that.existingGroups = that.getExistingConversationTitles();
            this.existingGroupMembers = [];
            that.showGroupMembership = true;
        },
        editCurrentConversation: function() {
            if (this.selectedConversationId == null) {
                return;
            }
            if (this.extractChatOwner(this.selectedConversationId) != this.context.username) {
                return;
            }
            let conversation = this.allConversations.get(this.selectedConversationId);
            this.editConversation(conversation);
        },
        editConversation: function(conversation) {
            if (conversation != null) {
                this.groupId = this.selectedConversationId;
                this.groupTitle = conversation.title;
                this.friendNames = this.friendnames;
                this.messages = this.messages;
                this.existingGroups = this.getExistingConversationTitles();
                this.existingGroupMembers = conversation.participants.slice();
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
        convertToPath: function(dir) {
            let dirWithoutLeadingSlash = dir.startsWith("/") ? dir.substring(1) : dir;
            return peergos.client.PathUtils.directoryToPath(dirWithoutLeadingSlash.split('/'));
        },
        deleteChatMessage: function(message) {
            let that = this;
            this.spinner(true);
            let chatController = this.allChatControllers.get(this.selectedConversationId);
            chatController.controller.generateHash(message.envelope).thenApply(messageRef => {
                let msg = new peergos.shared.messaging.messages.DeleteMessage(messageRef);
                that.sendMessage(that.selectedConversationId, msg).thenApply(function(res) {
                    that.refreshConversation(that.selectedConversationId);
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
        isConversationSelected: function (conversation) {
            return this.selectedConversationId == conversation.id;
        },
        getFileSize: function(props) {
                var low = props.sizeLow();
                if (low < 0) low = low + Math.pow(2, 32);
                return low + (props.sizeHigh() * Math.pow(2, 32));
        },
        getPublicKeyHashes: function(usernames) {
            let that = this;
            const usernameToPKH = new Map();
            let future = peergos.shared.util.Futures.incomplete();
            usernames.forEach(username => {
                that.context.getPublicKeys(username).thenApply(pkOpt => {
                    usernameToPKH.set(username, pkOpt.get().left);
                    if(usernameToPKH.size == usernames.length) {
                        let pkhs = [];
                        usernames.forEach(user => {
                            pkhs.push(usernameToPKH.get(user));
                        });
                        future.complete(peergos.client.JsUtil.asList(pkhs));
                    }
                });
            });
            return future;
        },
        inviteNewParticipants: function(conversationId, updatedMembers) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            if (updatedMembers.length == 0) {
                future.complete(true);
            } else {
                let chatController = this.allChatControllers.get(conversationId);
                let usernames = peergos.client.JsUtil.asList(updatedMembers);
                this.spinnerMessage = "adding participant(s) to chat";
                this.getPublicKeyHashes(updatedMembers).thenApply(pkhList => {
                    that.messenger.invite(chatController.controller, usernames, pkhList).thenApply(updatedController => {
                        chatController.controller = updatedController;
                        future.complete(true);
                    });
                });
            }
            return future;
        },
        reduceRemovingInvitations: function(conversationId, membersToRemove, index, future) {
            future.complete(true);
            /* not implemented yet!
            */
        },
        unInviteParticipants: function(conversationId, membersToRemove) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            this.reduceRemovingInvitations(conversationId, membersToRemove, 0, future);

            let future2 = peergos.shared.util.Futures.incomplete();
            future.thenApply(done => {
                future2.complete(true);
            });
            return future2;
        },
        reduceNewChats: function(pairs, index, future) {
            let that = this;
            if (index == pairs.length) {
                future.complete(true);
            } else {
                let currentPair = pairs[index];
                let sharedChatDir = currentPair.right;
                this.messenger.cloneLocallyAndJoin(sharedChatDir).thenApply(res => {
                    that.reduceNewChats(pairs, ++index, future);
                }).exceptionally(function(throwable) {
                    that.showMessage(throwable.getMessage());
                    that.reduceNewChats(pairs, ++index, future);
                });
            }
        },
        loadNewChats: function(pairs) {
            let future = peergos.shared.util.Futures.incomplete();
            this.reduceNewChats(pairs, 0, future);
            return future;
        },
        removeSelfFromParticipants: function(participants) {
            let copyOfParticipants = participants.slice();
            let selfIndex = copyOfParticipants.findIndex(v => v === this.context.username);
            if (selfIndex > -1) {
                copyOfParticipants.splice(selfIndex, 1);
            }
            return copyOfParticipants;
        },
        extractChatOwner: function(chatUuid) {
            let withoutPrefix = chatUuid.substring(5);//chat:
            return withoutPrefix.substring(0,withoutPrefix.indexOf(":"));
        },
        readChatMessages: function(controller) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let chatController = that.allChatControllers.get(controller.chatUuid);
            if (chatController == null) {
                let chatOwner = this.extractChatOwner(controller.chatUuid);
                chatController = {controller:controller, startIndex: 0, owner: chatOwner};
                that.allChatControllers.set(controller.chatUuid, chatController);
                that.allMessageThreads.set(controller.chatUuid, []);
                let participants = that.removeSelfFromParticipants(controller.getMemberNames().toArray());
                let conversation = {id: controller.chatUuid, participants: participants};
                if (participants.length == 1) {
                    conversation.profileImageNA = false;
                }
                that.allConversations.set(controller.chatUuid, conversation);
            }
            chatController.controller = controller;
            let conversation = this.allConversations.get(controller.chatUuid);
            that.messenger.mergeAllUpdates(controller, this.socialState).thenApply(updatedController => {
                chatController.controller = updatedController;
                let participants = that.removeSelfFromParticipants(updatedController.getMemberNames().toArray());
                conversation.participants = participants;
                if (participants.length == 1) {
                    conversation.profileImageNA = false;
                }
                that.getAllMessages(chatController).thenApply(messages => {
                    that.generateMessageHashes(chatController, messages).thenApply(messagePairs => {
                        future.complete({conversationId: controller.chatUuid, messagePairs: messagePairs});
                    });
                });
            }).exceptionally(function(throwable) {
                that.showMessage(throwable.getMessage());
            });
            return future;
        },
        loadChatMessages: function(chats) {
            let that = this;
            let accumulator = [];
            let future = peergos.shared.util.Futures.incomplete();
            if (chats.length == 0) {
                future.complete(accumulator);
            }
            chats.forEach(chat => {
                that.readChatMessages(chat).thenApply(result => {
                    accumulator.push(result);
                    if (accumulator.length == chats.length) {
                        future.complete(accumulator);
                    }
                });
            });
            return future;
        },
        buildConversations: function() {
            let conversationList = [];
            let conversationIconCandidates = [];
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
                if (val.participants.length == 1 && val.profileImage == null && !val.profileImageNA) {
                    conversationIconCandidates.push(val);
                }
            });
            conversationList.sort(function(aVal, bVal){
                return bVal.lastModified.localeCompare(aVal.lastModified)
            });
            this.conversations = conversationList;
            let that = this;
            if (conversationIconCandidates.length > 0) {
                Vue.nextTick(function() {
                    that.loadConversationIcons(conversationIconCandidates);
                });
            }
        },
        formatParticipants: function (participants) {
            let list = participants.join(',');
            return list;
        },
        buildMessageThread: function (conversationId) {
            if (conversationId != null) {
                let conversation = this.allConversations.get(conversationId);
                var title = this.truncateText(conversation.title, 20);
                let participants = " - " + this.truncateText(this.formatParticipants(conversation.participants), 20);
                title = title + participants;
                this.chatTitle = title;
                this.selectedConversationId = conversationId;
                let currentMessageThread = this.allMessageThreads.get(conversationId);
                if (currentMessageThread != null) {
                    this.messageThread = currentMessageThread.slice();
                } else {
                    this.messageThread = [];
                }
            } else {
                this.chatTitle = "";
                this.messageThread = [];
            }
        },
        send: function() {
            let that = this;
            let text = this.newMessageText;
            let conversationId = this.selectedConversationId;
            if (this.savingNewMsg || this.selectedConversationId == null ) {
                return;
            }
            that.savingNewMsg = true;
            let attachment = this.attachment;
            if (this.editMessage != null) {
                if (this.editMessage.sender != this.context.username) {
                    return;
                }
                this.editExistingMessage(conversationId, this.editMessage.envelope, text, attachment).thenApply(function(result) {
                    that.refreshConversation(conversationId);
                });
            } else if (this.replyToMessage != null) {
                this.replyTo(conversationId, this.replyToMessage.envelope, text, attachment).thenApply(function(result) {
                    that.refreshConversation(conversationId);
                });
            } else {
                this.newMessage(conversationId, text, attachment).thenApply(function(result) {
                    that.refreshConversation(conversationId);
                });
            }
        },
        editExistingMessage: function(conversationId, editMessage, text, attachment) {
            let future = peergos.shared.util.Futures.incomplete();
            if (attachment != null) {
                console.log("not implemented!");
                future.complete(false);
            } else {
                this.sendEditMessage(conversationId, editMessage, text, null, null, null, future);
            }
            return future;
        },
        replyTo: function(conversationId, replyToMessage, text, attachment) {
            let future = peergos.shared.util.Futures.incomplete();
            if (attachment != null) {
                console.log("not implemented!");
                future.complete(false);
            } else {
                this.sendReplyTo(conversationId, replyToMessage, text, null, null, null, future);
            }
            return future;
        },
        newMessage: function(conversationId, text, attachment) {
            let future = peergos.shared.util.Futures.incomplete();
            if (attachment != null) {
                console.log("not implemented!");
                future.complete(false);
            } else {
                this.sendNewMessage(conversationId, text, null, null, null, future);
            }
            return future;
        },
        sendEditMessage: function(conversationId, editMessage, text, mediaFile, mediaFilePath, parentMessage, future) {
            let that = this;
            this.spinner(true);
            let msg = peergos.shared.messaging.messages.ApplicationMessage.text(text);
            let chatController = this.allChatControllers.get(conversationId);
            chatController.controller.generateHash(editMessage).thenApply(messageRef => {
                let edit = new peergos.shared.messaging.messages.EditMessage(messageRef, msg);
                that.sendMessage(conversationId, edit).thenApply(function(res) {
                    future.complete(true);
                });
            });
        },
        sendReplyTo: function(conversationId, replyToMessage, text, mediaFile, mediaFilePath, parentMessage, future) {
            let that = this;
            this.spinner(true);
            let msg = peergos.shared.messaging.messages.ApplicationMessage.text(text);
            peergos.shared.messaging.messages.ReplyTo.build(replyToMessage, msg, this.context.crypto.hasher).thenApply(function(replyTo) {
                that.sendMessage(conversationId, replyTo).thenApply(function(res) {
                    future.complete(true);
                });
            });
        },
        sendNewMessage: function(conversationId, text, mediaFile, mediaFilePath, parentMessage, future) {
            let that = this;
            this.spinner(true);
            let msg = peergos.shared.messaging.messages.ApplicationMessage.text(text);
            this.sendMessage(conversationId, msg).thenApply(function(res) {
                future.complete(true);
            });
        },
        sendMessage: function(conversationId, msg) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let chatController = this.allChatControllers.get(conversationId);
            let controller = chatController.controller;
            this.messenger.sendMessage(controller, msg).thenApply(function(updatedController) {
                chatController.controller = updatedController;
                that.newMessageText = "";
                that.savingNewMsg = false;
                that.replyToMessage = null;
                that.editMessage = null;
                that.attachment = null;
                that.spinner(false);
                future.complete(true);
            }).exceptionally(function(throwable) {
                that.showMessage(throwable.getMessage());
                that.spinner(false);
                that.savingNewMsg = false;
                future.complete(false);
            });
            return future;
        },
        changeTitle: function(conversationId, text) {
            let future = peergos.shared.util.Futures.incomplete();
            let that = this;
            let chatController = this.allChatControllers.get(conversationId);
            let controller = chatController.controller;
            this.messenger.setGroupProperty(controller, "title", text).thenApply(function(updatedController) {
                chatController.controller = updatedController;
                future.complete(true);
            }).exceptionally(function(throwable) {
                that.showMessage(throwable.getMessage());
                that.spinner(false);
                future.complete(false);
            });
            return future;
        },
        createMessage: function(author, messageEnvelope, content, mediaFile, mediaFilePath, parentMessage) {
            let timestamp = messageEnvelope.creationTime;
            let fileType = mediaFile == null ? "" : mediaFile.getFileProperties().getType();
            let thumbnail = (mediaFile != null && mediaFile.getFileProperties().thumbnail.ref != null) ? mediaFile.getBase64Thumbnail() : "";
            let entry = {isStatusMsg: false, file: mediaFile, fileType: fileType,
                sender: author, hasThumbnail: thumbnail.length > 0, thumbnail: thumbnail
                , sendTime: timestamp.toString(), contents: content, mediaFilePath: mediaFilePath
                , envelope: messageEnvelope, parentMessage: parentMessage, edited: false, deleted : false};
            return entry;
        },
        createStatusMessage: function(timestamp, message) {
            let entry = {isStatusMsg: true, sender: null, hasThumbnail: false,
                sendTime: timestamp.toString(), contents: message};
            return entry;
        },
    }
}
