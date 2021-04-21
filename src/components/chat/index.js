module.exports = {
    template: require('chat.html'),
    data: function() {
        return {
            showSpinner: false,
            conversations: [],
            messageThread: [],
            selectedConversationId: null,
            newMessageText: "",
            allConversations: new Map(),
            allChatControllers: new Map(),
            allMessageThreads: new Map(),
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
            attachment: null,
            emojiChooserBtn: null,
            emojiPicker: null,
            messenger: null,
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
            this.reduceLoadAllConversationIconsAsync(0, items);
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
            let text = conversation.title.length > 0 ? this.truncateText(conversation.title, 15)
                        : this.truncateText(this.formatParticipants(conversation.participants), 15)
            return text;
        },
        filterConversations: function() {
            this.buildConversations();
        },
        updateMessageThreads: function (allChats) {
            for(var i = 0; i < allChats.length; i++) {
                let chatMessages = allChats[i].messages;
                this.updateMessageThread(allChats[i].conversationId, chatMessages);
            }
        },
        updateMessageThread: function (conversationId, chatMessages) {
            let messageThread = this.allMessageThreads.get(conversationId);
            for(var j = 0; j < chatMessages.length; j++) {
                let chatEnvelope = chatMessages[j];
                let payload = chatEnvelope.payload;
                let type = payload.type().toString();
                let postTime = peergos.client.JsUtil.now(); //todo
                if (type == 'GroupState') {//type
                    if(payload.key == "title") {
                        messageThread.push(this.createStatusMessage(postTime, "Conversation name changed to: " + payload.value));
                        let conversation = this.allConversations.get(conversationId);
                        conversation.title = payload.value;
                    } else {
                        messageThread.push(this.createStatusMessage(postTime, payload.value));
                    }
                } else if(type == 'Application') {
                    let chatController = this.allChatControllers.get(conversationId);
                    let author = chatController.controller.getAuthorUsername(chatEnvelope);
                    messageThread.push(this.createMessage(author, payload.body.content, null, null, null));
                }
            }
            this.allMessageThreads.set(conversationId, messageThread);
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
                    that.spinner(false);
                });
            });
        },
        refreshConversation: function(conversationId) {
            var that = this;
            this.spinner(true);
            let chatController = this.allChatControllers.get(conversationId);
            that.messenger.mergeAllUpdates(chatController.controller, this.socialState).thenApply(latestController => {
                chatController.controller = latestController;
                let startIndex = chatController.startIndex;
                latestController.getMessages(startIndex, startIndex + 1000).thenApply(result => {
                    let messages = result.toArray();
                    chatController.startIndex += messages.length;
                    that.updateMessageThread(conversationId, messages);
                    that.buildConversations();
                    that.buildMessageThread(conversationId);
                    that.updateScrollPane();
                    that.spinner(false);
                });
            });
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
        getExistingConversationTitles: function() {
            let existingGroups = [];
            this.conversations.forEach(conversation => {
                if (conversation.title.length > 0) {
                    existingGroups.push(conversation.title);
                }
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
            console.log("deleteChatMessage not implemented!");
            /*
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
            });*/
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
        selectConversation: function (conversation) {
            this.buildMessageThread(conversation.id);
        },
        isConversationSelected: function (conversation) {
            return this.selectedConversationId == conversation.id;
        },
        getFileSize: function(props) {
                var low = props.sizeLow();
                if (low < 0) low = low + Math.pow(2, 32);
                return low + (props.sizeHigh() * Math.pow(2, 32));
        },
        reduceNewInvitations: function(conversationId, updatedMembers, index, future) {
            let that = this;
            if (index == updatedMembers.length) {
                future.complete(true);
            } else {
                let chatController = this.allChatControllers.get(conversationId);
                let username = updatedMembers[index];
                this.context.getPublicKeys(username).thenApply(pkOpt => {
                    that.messenger.invite(chatController.controller, username, pkOpt.get().left).thenApply(updatedController => {
                        chatController.controller = updatedController;
                        that.reduceNewInvitations(conversationId, updatedMembers, ++index, future);
                    });
                });
            }
        },
        inviteNewParticipants: function(conversationId, updatedMembers) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            this.reduceNewInvitations(conversationId, updatedMembers, 0, future);

            let future2 = peergos.shared.util.Futures.incomplete();
            future.thenApply(done => {
                if (updatedMembers.length > 0) {
                    let text = "The following participant(s) have been added: " + updatedMembers.join(',');
                    that.sendStatus(conversationId, text).thenApply(function(res) {
                        future2.complete(true);
                    });
                } else {
                    future2.complete(true);
                }
            });
            return future2;
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
                if (membersToRemove.length > 0) {
                    let text = "The following participant(s) have been removed: " + membersToRemove.join(',');
                    that.sendStatus(conversationId, text).thenApply(function(res) {
                        future2.complete(true);
                    });
                } else {
                    future2.complete(true);
                }
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
                //todo paging!
                let startIndex = chatController.startIndex;
                updatedController.getMessages(startIndex, startIndex + 10000).thenApply(result => {
                    let messages = result.toArray();
                    chatController.startIndex += messages.length;
                    future.complete({conversationId: controller.chatUuid, messages: messages});
                });
            }).exceptionally(function(throwable) {
                that.showMessage(throwable.getMessage());
            });
            return future;
        },
        reduceLoadingMessages: function(chats, index, accumulator, future) {
            let that = this;
            if (index == chats.length) {
                future.complete(accumulator);
            } else {
                let chat = chats[index];
                this.readChatMessages(chat).thenApply(result => {
                    accumulator.push(result);
                    that.reduceLoadingMessages(chats, ++index, accumulator,  future);
                });
            }
        },
        loadChatMessages: function(chats) {
            let future = peergos.shared.util.Futures.incomplete();
            this.reduceLoadingMessages(chats, 0, [], future);
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
            let conversationId = this.selectedConversationId;
            if (this.savingNewMsg || this.selectedConversationId == null ) {
                return;
            }
            that.savingNewMsg = true;
            let attachment = this.attachment;
            if (this.replyToMessage != null) {
                console.log("reply not implemented!");
            } else {
                this.newMessage(conversationId, text, attachment).thenApply(function(result) {
                    console.log("message sent");
                    that.refreshConversation(conversationId);
                });
            }
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
        sendNewMessage: function(conversationId, text, mediaFile, mediaFilePath, parentMessage, future) {
            let that = this;
            this.spinner(true);
            let chatController = this.allChatControllers.get(conversationId);
            let controller = chatController.controller;
            let msg = peergos.shared.messaging.messages.ApplicationMessage.text(text);
            this.messenger.sendMessage(controller, msg).thenApply(function(updatedController) {
                chatController.controller = updatedController;
                that.newMessageText = "";
                that.savingNewMsg = false;
                that.replyToMessage = null;
                that.attachment = null;
                that.spinner(false);
                future.complete(true);
            }).exceptionally(function(throwable) {
                that.showMessage(throwable.getMessage());
                that.spinner(false);
                that.savingNewMsg = false;
                future.complete(false);
            });
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
        sendStatus: function(conversationId, text) {
            let future = peergos.shared.util.Futures.incomplete();
            let that = this;
            let chatController = this.allChatControllers.get(conversationId);
            let controller = chatController.controller;
            this.messenger.setGroupProperty(controller, "status", text).thenApply(function(updatedController) {
                chatController.controller = updatedController;
                future.complete(true);
            }).exceptionally(function(throwable) {
                that.showMessage(throwable.getMessage());
                that.spinner(false);
                future.complete(false);
            });
            return future;
        },
        createMessage: function(author, message, mediaFile, mediaFilePath, parentMessage) {
            let timestamp = peergos.client.JsUtil.now(); //todo
            let fileType = mediaFile == null ? "" : mediaFile.getFileProperties().getType();
            let thumbnail = (mediaFile != null && mediaFile.getFileProperties().thumbnail.ref != null) ? mediaFile.getBase64Thumbnail() : "";
            let entry = {isStatusMsg: false, file: mediaFile, fileType: fileType,
                sender: author, hasThumbnail: thumbnail.length > 0, thumbnail: thumbnail
                , sendTime: timestamp.toString(), contents: message, mediaFilePath: mediaFilePath
                , parentMessage: parentMessage, isDeleted: false};
            return entry;
        },
        createStatusMessage: function(timestamp, message) {
            let entry = {isStatusMsg: true, sender: null, hasThumbnail: false,
                sendTime: timestamp.toString(), contents: message, isDeleted: false};
            return entry;
        },
    }
}
