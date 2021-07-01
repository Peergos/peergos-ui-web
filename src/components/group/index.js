module.exports = {
    template: require('group.html'),
    data: function() {
        return {
            showSpinner: false,
            targetUsername: "",
            targetUsernames: [],
            errorTitle:'',
            errorBody:'',
            showError:false,
            membersToRemove: [],
            removeSelf: [],
            showPrompt: false,
            prompt_message: '',
            prompt_placeholder: '',
            prompt_max_input_size: null,
            prompt_value: '',
            prompt_consumer_func: () => {},
            displayedTitle: "",
            updateLabel: "Update",
            addLabel: "Add to Chat",
            genericLabel: "chat",
            isAdmin: false,
            haveRemovedSelf: false
        }
    },
    props: ['existingGroups', 'groupId', 'groupTitle', 'existingGroupMembers', 'friendNames', 'context', 'messages'
        , 'updatedGroupMembership', 'existingAdmins'],
    created: function() {
        this.displayedTitle = this.groupTitle;
        if (this.groupId == "") {
            this.updateLabel = "Create";
        }
        this.isAdmin = this.existingAdmins.findIndex(v => v === this.context.username) > -1;
        Vue.nextTick(this.setTypeAhead);
    },
    methods: {
        updateGroupMembership: function () {
            if (this.groupId == "" && this.displayedTitle == this.groupTitle) {
                this.showMessage("Click on title to set " + this.genericLabel + " name");
            } else {
                this.updatedGroupMembership(this.groupId, this.displayedTitle, this.existingGroupMembers.slice(), this.haveRemovedSelf);
                this.close();
            }
        },
        changeGroupTitle: function () {
            if (!this.isAdmin) {
                return;
            }
            let that = this;
            this.prompt_placeholder = 'New ' + this.genericLabel + ' name';
            this.prompt_value = this.displayedTitle;
            this.prompt_message = 'Enter a name';
            this.prompt_max_input_size = 20;
            this.prompt_consumer_func = function(prompt_result) {
                if (prompt_result === null)
                    return;
                if (prompt_result === this.displayedTitle)
                    return;
                let newName = prompt_result.trim();
                if (newName === '')
                    return;
                if (newName === '.' || newName === '..')
                    return;
                if (!newName.match(/^[a-z\d\-_\s]+$/i)) {
                    that.showMessage("Invalid " + that.genericLabel + " name. Use only alphanumeric characters plus space, dash and underscore");
                    return;
                }
                setTimeout(function(){
                    //make sure names are unique
                    for (var i=0;i < that.existingGroups.length; i++) {
                        let existingGroupName = that.existingGroups[i];
                        if (existingGroupName == newName) {
                            that.showMessage("Duplicate " + that.genericLabel + " name");
                            return;
                        }
                    }
                    that.displayedTitle = newName;
                });
            };
            this.showPrompt =  true;
        },
        close: function () {
            this.$emit("hide-group");
        },
        showMessage : function (title, body) {
            this.messages.push({
                title: title,
                body: body,
                show: true
            });
        },
        removeUserFromGroup : function () {
            if(this.removeSelf.length > 0) {
                this.haveRemovedSelf = true;
            }
            for (var i = 0; i < this.membersToRemove.length; i++) {
                let targetUsername = this.membersToRemove[i];
                let index = this.existingGroupMembers.indexOf(targetUsername);
                if (index > -1) {
                    this.existingGroupMembers.splice(index, 1);
                }
            }
            this.membersToRemove = [];
        },
        resetTypeahead: function() {
            this.targetUsernames = [];
            this.targetUsername = "";
            $('#friend-name-input').tokenfield('setTokens', []);
        },
        addUsersToGroup: function() {
            var that = this;
            var usersToAdd = this.targetUsernames.slice();
            if (usersToAdd.length == 0) {
                return;
            }
            for (var i = usersToAdd.length - 1; i >= 0; i--) {
                let targetUsername = usersToAdd[i];
                if(this.existingGroupMembers.indexOf(targetUsername) > -1) {
                    usersToAdd.splice(i, 1);
                } else {
                    this.existingGroupMembers.push(targetUsername);
                }
            }
            if (usersToAdd.length == 0) {
                that.errorTitle = "Already a member!";
                that.errorBody = "";
                that.showError = true;
                return;
            }
            that.resetTypeahead();
        },
	    setTypeAhead: function() {
            let allNames = this.friendNames;
            var engine = new Bloodhound({
              datumTokenizer: Bloodhound.tokenizers.whitespace,
              queryTokenizer: Bloodhound.tokenizers.whitespace,
              local: allNames
            });

            engine.initialize();

            $('#friend-name-input').tokenfield({
                minLength: 1,
                minWidth: 1,
                typeahead: [{hint: true, highlight: true, minLength: 1}, { source: suggestions }]
            });

            function suggestions(q, sync, async) {
                var matches, substringRegex;
                matches = [];
                substrRegex = new RegExp(q, 'i');
                $.each(allNames, function(i, str) {
                    if (substrRegex.test(str)) {
                        matches.push(str);
                    }
                });
                sync(matches);
            }
            let that = this;
            $('#friend-name-input').on('tokenfield:createtoken', function (event) {
                //only select from available items
            	var available_tokens = allNames;
            	var exists = true;
            	$.each(available_tokens, function(index, token) {
            		if (token === event.attrs.value)
            			exists = false;
            	});
            	if(exists === true) {
            		event.preventDefault();
                } else {
                    //do not allow duplicates in selection
                    var existingTokens = $(this).tokenfield('getTokens');
                    $.each(existingTokens, function(index, token) {
                        if (token.value === event.attrs.value)
                            event.preventDefault();
                    });
                }
            });
            $('#friend-name-input').on('tokenfield:createdtoken', function (event) {
        	    that.targetUsernames.push(event.attrs.value);
            });

            $('#friend-name-input').on('tokenfield:removedtoken', function (event) {
        	    that.targetUsernames.pop(event.attrs.value);
            });
        }
    }
}
