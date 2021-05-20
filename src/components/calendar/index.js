module.exports = {
    template: require('calendar.html'),
    data: function() {
        return {
            APPS_DIR_NAME: '.apps',
            CALENDAR_DIR_NAME: 'calendar',
            DATA_DIR_NAME: 'data',
            CALENDAR_FILE_EXTENSION: '.ics',
            CONFIG_FILENAME: 'App.config',
            NEW_CALENDAR_FILENAME: 'calendar.inf',
            showSpinner: false,
            spinnerMessage: "",
            calendarProperties: null,
            showPrompt: false,
            prompt_message: '',
            prompt_placeholder: '',
            prompt_max_input_size: null,
            prompt_value: '',
            prompt_consumer_func: () => {},
            showConfirm: false,
            confirm_message: "",
            confirm_body: "",
            confirm_consumer_cancel_func: () => {},
            confirm_consumer_func: () => {},
            showChoice: false,
            choice_message: '',
            choice_body: '',
            choice_consumer_func: () => {},
            choice_options: []
        }
    },
    props: ['context', 'messages', 'importFile', 'importCalendarPath', 'owner', 'shareWith', 'loadCalendarAsGuest', 'confirmImport', 'emailCalendarEvent'],
    created: function() {
        let that = this;
        this.displaySpinner();
        peergos.shared.user.App.init(that.context, "calendar").thenCompose(calendar => {
            if (that.loadCalendarAsGuest) {
                that.startListener(calendar);
            } else {
                that.getPropertiesFile(calendar).thenApply(props => {
                    that.calendarProperties = props;
                    that.startListener(calendar)
                })
            }
        });
    },
    methods: {
    frameUrl: function() {
        return this.frameDomain() + "/apps/calendar/index.html";
    },
    frameDomain: function() {
        return window.location.protocol + "//calendar." + window.location.host;
    },
    postMessage: function(obj) {
	var iframe = document.getElementById("calendar");
        iframe.contentWindow.postMessage(obj, '*');
    },
    startListener: function(calendar) {
	    var that = this;
	    var iframe = document.getElementById("calendar");
	    if (iframe == null) {
    		setTimeout(function(){that.startListener(calendar)}, 1000);
	    	return;
	    }
        // Listen for response messages from the frames.
        window.addEventListener('message', function (e) {
            // Normally, you should verify that the origin of the message's sender
            // was the origin and source you expected. This is easily done for the
            // unsandboxed frame. The sandboxed frame, on the other hand is more
            // difficult. Sandboxed iframes which lack the 'allow-same-origin'
            // header have "null" rather than a valid origin. This means you still
            // have to be careful about accepting data via the messaging API you
            // create. Check that source, and validate those inputs!
            if ((e.origin === "null" || e.origin === that.frameDomain()) && e.source === iframe.contentWindow) {
                if(e.data.type=="save") {
                    that.saveEvent(calendar, e.data);
                } else if(e.data.type=="saveAll") {
                    that.saveAllEvents(calendar, e.data);
                } else if(e.data.type=="deleteCalendar") {
                    that.deleteCalendar(calendar, e.data);
                } else if(e.data.type=="delete") {
                    that.deleteEvent(calendar, e.data);
                } else if(e.data.type=="displaySpinner") {
                    that.displaySpinner();
                } else if(e.data.type=="removeSpinner") {
                    that.removeSpinner();
                } else if(e.data.type=="displayMessage") {
                    that.displayMessage(e.data.message);
                } else if(e.data.type=="loadAdditional") {
                    that.loadAdditional(calendar, e.data.year, e.data.month, 'loadAdditional');
                } else if(e.data.type=="downloadEvent") {
                    that.downloadEvent(calendar, e.data.title, e.data.event);
                } else if(e.data.type=="emailEvent") {
                    that.emailEvent(e.data.title, e.data.event);
                } else if(e.data.type=="shareCalendarEvent") {
                    that.shareCalendarEvent(calendar, e.data.calendarName, e.data.id, e.data.year, e.data.month, e.data.isRecurring);
                } else if (e.data.action == 'requestRenameCalendar') {
                    that.renameCalendarRequest(calendar, e.data.calendar);
                } else if (e.data.action == 'requestCalendarColorChange') {
                    that.calendarColorChangeRequest(calendar, e.data.calendarName, e.data.newColor);
                } else if (e.data.action == 'requestAddCalendar') {
                    that.addCalendarRequest(calendar, e.data.newColor);
                } else if (e.data.action == 'requestChoiceSelection') {
                    that.requestChoiceSelection(e.data.method, e.data.includeChangeAll);
                } else if(e.data.action=="shareCalendar") {
                    that.shareCalendar(calendar, e.data.calendar);
                }
            }
        });
	    // Note that we're sending the message to "*", rather than some specific
            // origin. Sandboxed iframes which lack the 'allow-same-origin' header
            // don't have an origin which you can target: you'll have to send to any
            // origin, which might alow some esoteric attacks. Validate your output!
        let date = new Date();
        let year = 1900 + date.getYear();
        let month = date.getMonth() + 1;
        if (this.importFile != null) {
            this.importICSFile();
        } else if (this.importCalendarPath != null) {
            if (this.loadCalendarAsGuest) {
                let calendarDirectory = that.importCalendarPath.substring(that.importCalendarPath.lastIndexOf('/') +1);
                that.readCalendarFile(calendar, that.owner, calendarDirectory).thenApply(function(json) {
                    that.calendarProperties = new Object();
                    that.calendarProperties.calendars = [];
                    that.calendarProperties.calendars.push({name: json.name, owner: that.owner,
                       directory: calendarDirectory, color: json.color});
                   that.loadCalendars(calendar, year, month);
                });
            } else {
                this.importSharedCalendar(calendar, year, month);
            }
        } else {
            this.load(calendar, year, month);
        }
	},
	requestChoiceSelection: function(method, includeChangeAll) {
	    let that = this;
        this.choice_message = method + ' Event';
        this.choice_body = '';
        this.choice_consumer_func = (index) => {
            //console.log("response=" + response);
            let chosenIndex = includeChangeAll ? index : index + 1;
            that.postMessage({type: 'respondChoiceSelection', optionIndex: chosenIndex, method: method});
        };
        let options = [];
        if (includeChangeAll) {
            options.push('All events');
        }
        options.push('This event');
        options.push('This and future events');
        this.choice_options = options;
        this.showChoice = true;
	},
    renameCalendarRequest: function(calendar, calendarItem) {
        let that = this;
        this.prompt_placeholder = 'New Calendar name';
        this.prompt_value = calendarItem.name;
        this.prompt_message = 'Enter a new name';
        this.prompt_max_input_size = 20;
        this.prompt_consumer_func = function(prompt_result) {
            if (prompt_result === null)
                return;
            if (prompt_result === calendarItem.name)
                return;
            let newName = prompt_result.trim();
            if (newName === '')
                return;
            if (newName === '.' || newName === '..')
                return;
            if (!newName.match(/^[a-z\d\-_\s]+$/i)) {
                that.showMessage("Invalid calendar name. Use only alphanumeric characters plus space, dash and underscore");
                return;
            }
            setTimeout(function(){
                //make sure names are unique
                for (var i=0;i < that.calendarProperties.calendars.length; i++) {
                    let calendar = that.calendarProperties.calendars[i];
                    if (calendar.name == newName) {
                        return;
                    }
                }
                var calendarToChange = null;
                for (var i=0;i < that.calendarProperties.calendars.length; i++) {
                    let calendar = that.calendarProperties.calendars[i];
                    if (calendar.name == calendarItem.name) {
                        calendarToChange = calendar;
                        break;
                    }
                }
                calendarToChange.name = newName;
                calendarItem.name = newName;
                that.displaySpinner();
                that.updatePropertiesFile(calendar, that.calendarProperties).thenApply(res => {
                    that.removeSpinner();
                    that.postMessage({type: 'respondRenameCalendar', calendar: calendarItem});
                });
            });
        };
        this.showPrompt =  true;
    },
    addCalendarRequest: function(calendar, newColor) {
        let that = this;
        this.prompt_placeholder = 'New Calendar name';
        this.prompt_value = "";
        this.prompt_message = 'Enter a new name';
        this.prompt_max_input_size = 20;
        this.prompt_consumer_func = function(prompt_result) {
            if (prompt_result === null)
                return;
            let newName = prompt_result.trim();
            if (newName === '')
                return;
            if (newName === '.' || newName === '..')
                return;
            if (!newName.match(/^[a-z\d\-_\s]+$/i)) {
                that.showMessage("Invalid calendar name. Use only alphanumeric characters plus space, dash and underscore");
                return;
            }
            setTimeout(function(){
                //make sure names are unique
                for (var i=0;i < that.calendarProperties.calendars.length; i++) {
                    let calendar = that.calendarProperties.calendars[i];
                    if (calendar.name == newName) {
                        return;
                    }
                }
                //create directory
                that.displaySpinner();
                let newId = String(that.calendarProperties.calendars.length + 1);
                let dirName = that.generateDirectoryName();
                that.calendarProperties.calendars.push({name:newName, directory:dirName, color: newColor, shareable: true});
                that.createCalendarFile(calendar, dirName, {name:newName, color: newColor}).thenApply(done => {
                    that.updatePropertiesFile(calendar, that.calendarProperties).thenApply(res => {
                        that.removeSpinner();
                        that.postMessage({type: 'respondAddCalendar', newId: newId, newName: newName, newColor: newColor});
                    });
                });
            });
        };
        this.showPrompt =  true;
    },
    calendarColorChangeRequest: function(calendar, calendarName, newColor) {
        let that = this;
        for (var i=0;i < that.calendarProperties.calendars.length; i++) {
            let calendar = that.calendarProperties.calendars[i];
            if (calendar.name == calendarName) {
                calendar.color = newColor;
                break;
            }
        }
        that.displaySpinner();
        that.updatePropertiesFile(calendar, that.calendarProperties).thenApply(res => {
            that.removeSpinner();
            that.postMessage({type: 'respondCalendarColorChange', calendarName: calendarName, newColor: newColor});
        });
    },
    //https://stackoverflow.com/questions/105034/how-to-create-guid-uuid
    generateDirectoryName: function() {
      return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      ).substring(0, 8);
    },
    importICSFile: function() {
        let that = this;
        setTimeout(function() {
            that.postMessage({type: 'importICSFile', contents: that.importFile,
                isSharedWithUs: that.owner != that.context.username, loadCalendarAsGuest: that.loadCalendarAsGuest,
                username: that.context.username, confirmImport: that.confirmImport });
        }, 1000);
    },
    loadAdditional: function(calendar, year, month, messageType) {
        let that = this;
        this.getCalendarEventsForMonth(calendar, year, month).thenApply(function(allEvents) {
            that.loadAdditionalEvents(year, month, messageType, allEvents);
        });
    },
    loadAdditionalEvents: function(year, month, messageType, eventsThisMonth) {
        let that = this;
        let yearMonth = year * 12 + (month -1);
        setTimeout(function(){
            that.postMessage({type: messageType, currentMonth: eventsThisMonth
                , yearMonth: yearMonth });
        });
    },
    importSharedCalendar: function(calendar, year, month) {
        let that = this;
        let calendarDirectory = this.importCalendarPath.substring(this.importCalendarPath.lastIndexOf('/') +1);
        let existingCalendar = this.getCalendarForDirectory(calendarDirectory);
        if (existingCalendar != null) {
            that.showMessage("Calendar: " + existingCalendar.name + " already imported");
            that.close();
        } else {
            this.readCalendarFile(calendar, this.owner, calendarDirectory).thenApply(function(json) {
               that.removeSpinner();
               that.confirmImportCalendar(json.name,
                   () => {
                        that.showConfirm = false;
                        that.importCalendar(calendar, year, month, calendarDirectory, json.name, json.color);
                   },
                   () => { that.showConfirm = false; that.close();}
               );
            });
        }
    },
    importCalendar: function(calendar, year, month, directory, name, color) {
        let that = this;
        that.displaySpinner();
        let calendarName = name;
        var currentCalendarName = '' + calendarName;
        //make sure names are unique
        var done = false;
        var counter = 1;
        while (!done) {
            if (!that.calendarExists(currentCalendarName)) {
                done = true;
            } else {
                currentCalendarName = calendarName + ' (' + counter + ')';
                counter++;
            }
        }
        that.calendarProperties.calendars.push({name:currentCalendarName, owner: that.owner,
            directory: directory, color: color});
        that.updatePropertiesFile(calendar, that.calendarProperties).thenApply(res => {
            that.load(calendar, year, month);
        });
    },
    load: function(calendar, year, month) {
        let that = this;
        that.updateCalendarList(calendar).thenApply(function(modified) {
            if (modified) {
                that.updatePropertiesFile(calendar, that.calendarProperties).thenApply(res => {
                    that.loadCalendars(calendar, year, month);
                });
            } else {
                that.loadCalendars(calendar, year, month);
            }
        });
    },
    loadCalendars: function(calendar, year, month) {
        let that = this;
        that.getRecurringCalendarEvents(calendar).thenApply(function(recurringEvents) {
            that.getCalendarEventsAroundMonth(calendar, year, month).thenApply(function(allEvents) {
                that.loadEvents(year, month, allEvents.previous, allEvents.current,
                        allEvents.next, recurringEvents);
            });
        });
    },

    loadEvents: function(year, month, eventsPreviousMonth, eventsThisMonth, eventsNextMonth, recurringEvents) {
        let that = this;
        let yearMonth = year * 12 + (month-1);
        setTimeout(function(){
            that.spinnerMessage = "";
            let calendars = [];
            for(var i=0;i < that.calendarProperties.calendars.length;i++) {
                let calendar = that.calendarProperties.calendars[i];
                calendars.push({name: calendar.name, color: calendar.color, owner: calendar.owner, shareable: calendar.shareable});
            }
            Vue.nextTick(function() {
                that.postMessage({type: 'load', previousMonth: eventsPreviousMonth,
                    currentMonth: eventsThisMonth, nextMonth: eventsNextMonth, recurringEvents: recurringEvents,
                    yearMonth: yearMonth, username: that.context.username, calendars: calendars});
            });
        });
    },
    postDeleteCalendar: function(calendar, data) {
        let that = this;
        this.calendarProperties.calendars.splice(this.calendarProperties.calendars.findIndex(v => v.id === data.id), 1);
        this.updatePropertiesFile(calendar, this.calendarProperties).thenApply(res => {
            that.removeSpinner();
            that.postMessage({type: 'respondDeleteCalendar', calendar: data});
        });
    },
    deleteCalendar: function(calendar, data) {
        let that = this;
        var isSharedCalendar = false;
        for (var i=0; i < that.calendarProperties.calendars.length; i++) {
            let calendar = that.calendarProperties.calendars[i];
            if (calendar.name == data.calendarName) {
                if (calendar.owner != null && calendar.owner != that.context.username) {
                    isSharedCalendar = true;
                }
                break;
            }
        }
        this.confirmDeleteCalendar(data.calendarName,
            () => { that.showConfirm = false;
        	    that.displaySpinner();
        	    if (isSharedCalendar) {
                    that.postDeleteCalendar(calendar, data);
        	    } else {
                    let dirPath = peergos.client.PathUtils.directoryToPath(
                        [that.findCalendarDirectory(data.calendarName)]);
                    calendar.deleteInternal(dirPath).thenApply(function(res) {
                        that.postDeleteCalendar(calendar, data);
                    }).exceptionally(function(throwable) {
                        if (throwable.toString() == "java.util.NoSuchElementException") { //Because calendar had no events
                            that.postDeleteCalendar(calendar, data);
                        } else {
                            that.removeSpinner();
                            that.showMessage("Unable to delete Calendar");
                            console.log(throwable.getMessage());
                        }
                    });
                }
            },
            () => { that.showConfirm = false;}
        );
    },
    confirmDeleteCalendar: function(calendarName, deleteCalendarFunction, cancelFunction) {
        this.confirm_message='Are you sure you want to delete calendar: ' + calendarName + " ?";
        this.confirm_body='';
        this.confirm_consumer_cancel_func = cancelFunction;
        this.confirm_consumer_func = deleteCalendarFunction;
        this.showConfirm = true;
    },
    removeCalendarEvent: function(calendar, calendarName, year, month, id, isRecurring) {
        let calendarDirectory = this.findCalendarDirectory(calendarName);
        let dirPath =  isRecurring ? calendarDirectory + "/recurring" : calendarDirectory + "/" + year + "/" + month;
        let filename = id + this.CALENDAR_FILE_EXTENSION;
        let filePath = peergos.client.PathUtils.toPath(dirPath.split('/'), filename);
        return calendar.deleteInternal(filePath);
    },
    deleteEvent: function(calendar, item) {
	    const that = this;
	    that.displaySpinner();
        this.removeCalendarEvent(calendar, item.calendarName, item.year, item.month, item.Id, item.isRecurring).thenApply(function(res) {
	        that.removeSpinner();
        }).exceptionally(function(throwable) {
            that.showMessage("Unable to delete event","Please close calendar and try again");
            console.log(throwable.getMessage());
	        that.removeSpinner();
        });
    },
    displaySpinner: function() {
        this.showSpinner = true;
    },
    removeSpinner: function() {
        this.showSpinner = false;
    },
    displayMessage: function(msg) {
        this.showMessage(msg);
    },
    renameCalendar: function(msg) {
        this.showMessage(msg);
    },
    getPropertiesFile: function(calendar) {
        let that = this;
        let filePath = peergos.client.PathUtils.directoryToPath([this.CONFIG_FILENAME]);
        return calendar.readInternal(filePath).thenApply(data => {
            return JSON.parse(new TextDecoder().decode(data));
        }).exceptionally(function(throwable) {//File not found
            if (throwable.detailMessage.startsWith("File not found")) {
                let props = new Object();
                props.calendars = [];
                props.calendars.push({name: 'My Calendar', directory: 'default', color: '#00a9ff'});
                return props;
            } else {
                that.showMessage("Unable to load file","Please close calendar and try again");
            }
        });
    },
    updatePropertiesFile: function(calendar, json) {
        let filePath = peergos.client.PathUtils.directoryToPath([this.CONFIG_FILENAME]);
        let encoder = new TextEncoder();
        let uint8Array = encoder.encode(JSON.stringify(json));
        let bytes = convertToByteArray(uint8Array);
        return calendar.writeInternal(filePath, bytes);
    },
    readCalendarFile: function(calendar, owner, directory) {
        let that = this;
        let filePath = peergos.client.PathUtils.directoryToPath([directory, this.NEW_CALENDAR_FILENAME]);
        return calendar.readInternal(filePath, owner).thenApply(data => {
            return JSON.parse(new TextDecoder().decode(data));
        }).exceptionally(function(throwable) {//File not found
            let props = new Object();
            props.calendars = [];
            props.calendars.push({name: this.owner + "-shared", color: '#00a9ff'});
            return props;
        });
    },
    createCalendarFile: function(calendar, directory, json) {
        let filePath = peergos.client.PathUtils.directoryToPath([directory, this.NEW_CALENDAR_FILENAME]);
        let encoder = new TextEncoder();
        let uint8Array = encoder.encode(JSON.stringify(json));
        let bytes = convertToByteArray(uint8Array);
        return calendar.writeInternal(filePath, bytes);
    },
    calendarExists: function(calendarName) {
        for (var i=0; i < this.calendarProperties.calendars.length; i++) {
            let calendar = this.calendarProperties.calendars[i];
            if (calendar.name == calendarName) {
                return true;
            }
        }
        return false;
    },
    getCalendarForDirectory: function(calendarDirectory) {
        for (var i=0; i < this.calendarProperties.calendars.length; i++) {
            let calendar = this.calendarProperties.calendars[i];
            if (calendar.directory == calendarDirectory) {
                return calendar;
            }
        }
        return null;
    },
    findCalendarDirectory: function(calendarName) {
        for (var i=0; i < this.calendarProperties.calendars.length; i++) {
            let calendar = this.calendarProperties.calendars[i];
            if (calendar.name == calendarName) {
                return calendar.directory;
            }
        }
        return "default";
    },
    updateCalendarEvent: function(calendar, item) {
        let calendarDirectory = this.findCalendarDirectory(item.calendarName);
        let dirPath =  item.isRecurring ? calendarDirectory + "/recurring" : calendarDirectory + "/" + item.year + "/" + item.month;
        let filename = item.Id + this.CALENDAR_FILE_EXTENSION;
        let filePath = peergos.client.PathUtils.toPath(dirPath.split('/'), filename);
        let encoder = new TextEncoder();
        let uint8Array = encoder.encode(item.item);
        let bytes = convertToByteArray(uint8Array);
        return calendar.writeInternal(filePath, bytes);
    },
    saveEvent: function(calendar, item) {
	    const that = this;
	    that.displaySpinner();
	    if (item.action == "createRecurring") {
            this.moveEvent(calendar, item, false);
	    } else if (item.action == "deleteRecurring") {
            this.moveEvent(calendar, item, true);
	    } else {
            if(item.calendarName == item.previousCalendarName) {
                this.updateCalendarEvent(calendar, item).thenApply(function(res) {
                    that.removeSpinner();
                }).exceptionally(function(throwable) {
                    that.showMessage("Unable to save event","Please close calendar and try again");
                    console.log(throwable.getMessage());
                    that.removeSpinner();
                });
            } else {
                this.moveEvent(calendar, item, item.isRecurring);
            }
	    }
    },
    moveEvent: function(calendar, item, removeRecurring) {
        const that = this;
        this.removeCalendarEvent(calendar, item.previousCalendarName, item.year, item.month, item.Id, removeRecurring).thenApply(function(res) {
            that.updateCalendarEvent(calendar, item).thenApply(function(res2) {
                that.removeSpinner();
            }).exceptionally(function(throwable) {
                that.showMessage("Unable to save moved event","Please re-create event");
                console.log(throwable.getMessage());
                that.removeSpinner();
            });
        }).exceptionally(function(throwable) {
            that.showMessage("Unable to move event","Please close calendar and try again");
            console.log(throwable.getMessage());
            that.removeSpinner();
        });
    },
    saveAllEvents: function(calendar, data) {
        this.removeSpinner();
        this.saveAllEventsRecursive(calendar, data.items, 0, data.showConfirmation);
    },
    saveAllEventsRecursive: function(calendar, items, index, showConfirmation) {
        const that = this;
        if (index == items.length) {
            if (showConfirmation) {
                that.close();
            } else {
    	        that.removeSpinner();
                that.showMessage("Imported: " + items.length + " event(s)");
            }
        } else {
            let item = items[index];
            if (showConfirmation) {
                this.confirmImportEventFile(item.summary,
                    () => { that.showConfirm = false; that.importEventFile(calendar, items, index, showConfirmation);},
                    () => { that.showConfirm = false; that.saveAllEventsRecursive(calendar, items, ++index, showConfirmation);}
                );
            } else {
                this.importEventFile(calendar, items, index, showConfirmation);
            }
        }
    },
    importEventFile: function(calendar, items, index, showConfirmation) {
        let that = this;
        let item = items[index];
        that.displaySpinner();
        this.updateCalendarEvent(calendar, item).thenApply(function(res) {
           that.saveAllEventsRecursive(calendar, items, ++index, showConfirmation);
        }).exceptionally(function(throwable) {
           that.removeSpinner();
           if (showConfirmation) {
                that.close();
           }
           that.showMessage("Unable to import event");
           console.log(throwable.getMessage());
        });
    },
    confirmImportEventFile: function(summary, importFunction, cancelFunction) {
        this.confirm_message='Do you wish to import Event: ' + summary.datetime
                + ' - ' + summary.title + ' ?';
        this.confirm_body='';
        this.confirm_consumer_cancel_func = cancelFunction;
        this.confirm_consumer_func = importFunction;
        this.showConfirm = true;
    },
    confirmImportCalendar: function(calendarName, importFunction, cancelFunction) {
        this.confirm_message='Do you wish to import Calendar: ' + calendarName + ' ?';
        this.confirm_body='';
        this.confirm_consumer_cancel_func = cancelFunction;
        this.confirm_consumer_func = importFunction;
        this.showConfirm = true;
    },
    getRecurringCalendarEvents: function(calendar) {
        let that = this;
        let accumulator = [];
        let future = peergos.shared.util.Futures.incomplete();
        if (that.calendarProperties.calendars.length == 0) {
            future.complete(accumulator);
        }
        that.calendarProperties.calendars.forEach(currentCalendar => {
            let dirStr = currentCalendar.directory + "/recurring";
            let directoryPath = peergos.client.PathUtils.directoryToPath(dirStr.split('/'));
            calendar.dirInternal(directoryPath, currentCalendar.owner).thenApply(filenames => {
                that.spinnerMessage = "Loading recurring calendar events from: " + currentCalendar.name;
                that.getEventsForMonth(calendar, currentCalendar.name, currentCalendar.owner, dirStr, filenames.toArray([])).thenApply(res => {
                    accumulator.push(res);
                    if (accumulator.length == that.calendarProperties.calendars.length) {
                        future.complete(accumulator.reduce((a, b) => a.concat(b), []));
                    }
                })
            });
        });
        return future;
    },
    getCalendarEventsForMonth: function(calendar, year, month) {
        let that = this;
        let accumulator = [];
        let future = peergos.shared.util.Futures.incomplete();
        if (that.calendarProperties.calendars.length == 0) {
            future.complete(accumulator);
        }
        that.calendarProperties.calendars.forEach(currentCalendar => {
            let dirStr = currentCalendar.directory + "/" + year + "/" + month;
            let directoryPath = peergos.client.PathUtils.directoryToPath(dirStr.split('/'));
            calendar.dirInternal(directoryPath, currentCalendar.owner).thenApply(filenames => {
                that.spinnerMessage = "Loading calendar events from: " + currentCalendar.name + " for " + year + "-" + month;
                that.getEventsForMonth(calendar, currentCalendar.name, currentCalendar.owner, dirStr, filenames.toArray([])).thenApply(res => {
                    accumulator.push(res);
                    if (accumulator.length == that.calendarProperties.calendars.length) {
                        future.complete(accumulator.reduce((a, b) => a.concat(b), []));
                    }
                })
            });
        });
        return future;
    },
    updateCalendarList: function(calendar) {
        let that = this;
        let modified = [false];
        let calendarsToDelete = [];
        let processed = [];
        let future = peergos.shared.util.Futures.incomplete();
        if (that.calendarProperties.calendars.length == 0) {
            future.complete(false);
        }
        that.calendarProperties.calendars.forEach(currentCalendar => {
            let directoryPath = peergos.client.PathUtils.directoryToPath(currentCalendar.directory.split('/'));
            calendar.dirInternal(directoryPath, currentCalendar.owner).thenApply(filenames => {
                if (filenames.isEmpty() && currentCalendar.owner != null) { //unshared or deleted
                    calendarsToDelete.push(currentCalendar.directory);
                    modified[0] = true;
                }
                processed.push(currentCalendar.name);
                if (processed.length == that.calendarProperties.calendars.length) {
                    calendarsToDelete.forEach(directory => {
                        let index = that.calendarProperties.calendars.findIndex(v => v.directory === directory);
                        that.calendarProperties.calendars.splice(index, 1);
                    });
                    future.complete(modified[0]);
                }
            });
        });
        return future;
    },
    getCalendarEventsAroundMonth: function(calendar, year, month) {
        let that = this;
        let previousMonth = month == 1 ? {name: 'previous', year:year -1, month: 12}
                : {name: 'previous', year: year, month:month -1};
        let currentMonth = {name: 'current', year: year, month: month};
        let nextMonth = month == 12 ? {name: 'next', year:year +1, month:1}
                : {name: 'next', year:year, month:month +1};

        let loop = [previousMonth, currentMonth, nextMonth];
        let future = peergos.shared.util.Futures.incomplete();
        const resultMap = new Map();
        loop.forEach(currentMonth => {
            that.getCalendarEventsForMonth(calendar, currentMonth.year, currentMonth.month).thenApply(res => {
                    resultMap.set(currentMonth.name, res);
                    if (resultMap.size == 3) {
                        let result = {previous: resultMap.get('previous'), current: resultMap.get('current'), next: resultMap.get('next')};
                        future.complete(result);
                    }
            })
        });
        return future;
    },
    getEventsForMonth: function(calendar, calendarName, owner, directory, filenames) {
        let that = this;
        let accumulator = [];
        let future = peergos.shared.util.Futures.incomplete();
        if (filenames.length == 0) {
            future.complete(accumulator);
        }
        filenames.forEach(eventFilename => {
            let filePath = peergos.client.PathUtils.toPath(directory.split('/'), eventFilename);
            calendar.readInternal(filePath, owner).thenApply(data => {
                accumulator.push({calendarName: calendarName, data: new TextDecoder().decode(data)});
                if (accumulator.length == filenames.length) {
                    future.complete(accumulator);
                }
            });
        });
        return future;
    },
    downloadEvent: function(calendar, title, event) {
        let that = this;
        this.displaySpinner();
        let encoder = new TextEncoder();
        let uint8Array = encoder.encode(event);
        let data = convertToByteArray(uint8Array);
        let blob =  new Blob([data], {type: "octet/stream"});
        let url = window.URL.createObjectURL(blob);
        let link = document.getElementById("downloadEventAnchor");
        link.href = url;
        link.type = "text/calendar";
        link.download = 'event - ' + title + '.ics';
        link.click();
        this.removeSpinner();
    },
    emailEvent: function(title, event) {
        console.log("email event");
        this.$emit("hide-calendar");
        this.emailCalendarEvent(title, event);
    },
    shareCalendarEvent: function(calendar, calendarName, id, year, month, isRecurring) {
        let calendarDirectory = this.findCalendarDirectory(calendarName);
        let dirPath =  isRecurring ? calendarDirectory + "/recurring" : calendarDirectory + "/" + year + "/" + month;
        this.shareWith(this.CALENDAR_DIR_NAME + '/' + this.DATA_DIR_NAME + "/" + dirPath,
            id + '.ics', false, true, 'Calendar Event');
    },
    shareCalendar: function(calendar, calendar) {
        let calendarDirectory = this.findCalendarDirectory(calendar.name);
        this.shareWith(this.CALENDAR_DIR_NAME + '/' + this.DATA_DIR_NAME, calendarDirectory, false, true,
            'Calendar - ' + calendar.name);
    },
    showMessage: function(title, body) {
        this.messages.push({
            title: title,
            body: body,
            show: true
        });
    },
    close: function () {
        this.$emit("hide-calendar");
    }
    }
}
