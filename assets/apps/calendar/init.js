var mainWindow;
var origin;

let handler = function (e) {
      // You must verify that the origin of the message's sender matches your
      // expectations. In this case, we're only planning on accepting messages
      // from our own origin, so we can simply compare the message event's
      // origin to the location of this document. If we get a message from an
      // unexpected host, ignore the message entirely.
      let parentDomain = window.location.host.substring(window.location.host.indexOf(".")+1)
      if (e.origin !== (window.location.protocol + "//" + parentDomain))
          return;

      mainWindow = e.source;
      origin = e.origin;
      if (e.data.type == "load") {
          initialiseCalendar(e.data.username == null ? true : false, e.data.calendars);
          load(e.data.previousMonth, e.data.currentMonth, e.data.nextMonth, e.data.recurringEvents, e.data.yearMonth, e.data.username);
      } else if (e.data.type == "loadAdditional") {
          loadAdditional(e.data.currentMonth, e.data.yearMonth);
      } else if (e.data.type == "respondRenameCalendar") {
          respondToCalendarRename(e.data.calendar);
      } else if (e.data.type == "respondDeleteCalendar") {
          respondToCalendarDelete(e.data.calendar);
      } else if (e.data.type == "respondAddCalendar") {
          respondToCalendarAdd(e.data.newId, e.data.newName, e.data.newColor);
      } else if (e.data.type == "respondCalendarColorChange") {
          respondToCalendarColorChange(e.data.calendarName, e.data.newColor);
      } else if (e.data.type == "respondChoiceSelection") {
          respondToChoiceSelection(e.data.optionIndex, e.data.method);
      } else if(e.data.type == "importICSFile") {
          loadCalendarAsGuest = e.data.loadCalendarAsGuest;
          if(loadCalendarAsGuest) {
              initialiseCalendar(true, []);
          } else {
              setCalendars(true, []);
          }
          importICSFile(e.data.contents, e.data.username, e.data.isSharedWithUs, loadCalendarAsGuest, "My Calendar", e.data.confirmImport);
      }
};
window.addEventListener('message', handler);
let calendarVersions = ['-//iCal.js','-//peergos.v1'];
let currentVersion = 1;
var currentUsername;
var cal, resizeThrottled;
var useCreationPopup = true;
var useDetailPopup = true;
var datePicker, selectedCalendar;
var CalendarList = [];
let ScheduleCache = [];
let CachedYearMonths = [];
let LoadedEvents = [];
let RecurringSchedules = [];
var currentMoment = moment();
var loadCalendarAsGuest = false;
var eventToActOn = null;
let CALENDAR_ID_MY_CALENDAR = "1";

let CALENDAR_EVENT_CANCELLED = "Cancelled";
let CALENDAR_EVENT_ACTIVE = "Active";

var colorpicker = null;
let colorPalette = ['#181818', '#282828', '#383838', '#585858', '#B8B8B8', '#D8D8D8', '#E8E8E8', '#F8F8F8', '#AB4642', '#DC9656', '#F7CA88', '#A1B56C', '#86C1B9', '#7CAFC2', '#BA8BAF', '#A16946'];
let colorPickerElement = document.getElementById('color-picker');

let addCalendarButton = document.getElementById('add-calendar-button');
addCalendarButton.onclick=function(e) {
    addCalendar();
};
let showConfigurationButton = document.getElementById('show-configuration-button');
showConfigurationButton.onclick=function(e) {
    showConfigurationPopup();
};
let calendarSettingsButton = document.getElementById('calendar-settings');
calendarSettingsButton.onclick=function(e) {
    toggleCalendarsView(e);
};

//--rrule
//These 2 are only internal for display
let recurrenceIdSeparatorToken = '|';
let recurringEventIdSeparatorToken = '^';
//Can appear as part of Id saved
let recurringEventSplitSeparatorToken = '_R';
var rrule = "";
var rrule_handler = null;
var previousRepeatCondition = "";
var rruleEditable = true;

let suffix = ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"];
let byDayLongLabelParts = "Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday".split(',');
let byDayMediumLabelParts = "Sun,Mon,Tue,Wed,Thu,Fri,Sat".split(',');
let monthLongLabelParts = "January,February,March,April,May,June,July,August,September,October,November,December".split(',');
let monthShortLabelParts = "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec".split(',');
let byDayLabelParts = "SU,MO,TU,WE,TH,FR,SA".split(',');
let byMonthDayLabelParts = "1SU,1MO,1TU,1WE,1TH,1FR,1SA,2SU,2MO,2TU,2WE,2TH,2FR,2SA,3SU,3MO,3TU,3WE,3TH,3FR,3SA,4SU,4MO,4TU,4WE,4TH,4FR,4SA,5SU,5MO,5TU,5WE,5TH,5FR,5SA,-1SU,-1MO,-1TU,-1WE,-1TH,-1FR,-1SA".split(',');
let weeks = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Last'];
let weeksLowercase = ['first', 'second', 'third', 'fourth', 'fifth', 'last'];

let monthLabels = "";
for(var i = 1; i < 13; i++) {
    monthLabels = monthLabels + i + " ";
}
let monthLabelParts = monthLabels.trim().split(" ");

let dateLabels = "";
for(var i = 1; i < 32; i++) {
    dateLabels = dateLabels + i + " ";
}
let byDateLabelParts = dateLabels.trim().split(" ");

//--end-rrule

function buildUI(isCalendarReadonly) {
    let uiDiv = document.getElementById("ui");
    uiDiv.classList.remove("calendar-hidden");
    if (isCalendarReadonly) {
        let settingsBtn = document.getElementById("calendar-settings");
        settingsBtn.style.display = 'none';
    }
    cal = new tui.Calendar('#calendar', {
        usageStatistics: false,
        defaultView: 'month',
        //week: {
        //	startDayOfWeek: 1
        //},
        //month: {
        //	startDayOfWeek: 1
        //},
        taskView: false,
        useCreationPopup: useCreationPopup,
        useDetailPopup: useDetailPopup,
        calendars: CalendarList,
        isReadOnly: isCalendarReadonly,
        template: {
            allday: function(schedule) {
                return getTimeTemplate(schedule, true);
            },
            time: function(schedule) {
                return getTimeTemplate(schedule, false);
            }
        }
    });

    cal.on({
        'clickMore': function(e) {
            //console.log('clickMore', e);
        },
        'clickSchedule': function(e) {
            //console.log('clickSchedule', e);
        },
        'clickDayname': function(date) {
            //console.log('clickDayname', date);
        },
        'beforeCreateSchedule': function(e) {
            //console.log('beforeCreateSchedule', e);
            let schedule = buildNewSchedule(e);
            let serialisedSchedule = serialiseICal(schedule, true);
            if (schedule.raw.hasRecurrenceRule) {
                RecurringSchedules.push(schedule);
                CachedYearMonths.forEach(function(yearMonth) {
                    cal.createSchedules(loadSchedule(schedule, yearMonth));
                });
            } else {
                cal.createSchedules([schedule]);
                addToCache(schedule);
            }
            refreshScheduleVisibility();
            save(schedule, serialisedSchedule, schedule.calendarId);
        },
        'beforeUpdateSchedule': function(e) {
            return handleScheduleUpdate(e);
        },
        'beforeDeleteSchedule': function(e) {
            //console.log('beforeDeleteSchedule', e);
            handleScheduleDeletion(e);
        },
        'afterRenderSchedule': function(e) {
            var schedule = e.schedule;
            // var element = cal.getElement(schedule.id, schedule.calendarId);
            // console.log('afterRenderSchedule', element);
        },
        'clickTimezonesCollapseBtn': function(timezonesCollapsed) {
            //console.log('timezonesCollapsed', timezonesCollapsed);
            if (timezonesCollapsed) {
                cal.setTheme({
                    'week.daygridLeft.width': '77px',
                    'week.timegridLeft.width': '77px'
                });
            } else {
                cal.setTheme({
                    'week.daygridLeft.width': '60px',
                    'week.timegridLeft.width': '60px'
                });
            }

            return true;
        }
    });
}
function hasScheduleMoved(oldDate, newDate) {
    if (newDate == null) {
        return false;
    }
    if (oldDate.start.getFullYear() !== newDate.getFullYear()){
        return true;
    }
    if (oldDate.start.getMonth() !== newDate.getMonth()){
        return true;
    }
    if (oldDate.start.getDate() !== newDate.getDate()){
        return true;
    }
    return false;
}
function handleScheduleUpdate(event) {
    var schedule = event.schedule;
    var changes = event.changes;
    //do not simply return if no changes. Memo, rrule text is not recorded as a change!
    //if(changes == null) {
    //    return;
    //}
    let previousCalendarId = schedule.calendarId;
    //console.log('beforeUpdateSchedule', e);

    if (changes && !changes.isAllDay && schedule.category === 'allday') {
        changes.category = 'time';
    }
    let originalSchedule = cal.getSchedule(schedule.id, previousCalendarId);
    if (changes && changes.start != null && !scheduleSameMonth(originalSchedule.start, changes.start)) { //moving across month boundary will currently duplicate event
        return false;
    }
    if ((originalSchedule.recurrenceRule.length > 0 || originalSchedule.raw.isException ) && changes != null) {
        //if dragged in UI, then reject change!
        if (hasScheduleMoved(schedule, changes.start)) {
            return false;
        }
    }
    if (originalSchedule.raw.previousRecurrenceRule.length > 0 || originalSchedule.raw.isException) {
        if(rrule.length > 0) {
            if (changes && (changes.start != null || changes.end != null || changes.isAllDay != null)) {
                requestChoiceSelection("Edit", event, false);
            } else {
                requestChoiceSelection("Edit", event, true);
            }
        } else {
            editRecurringSchedule(0, event);
        }
    } else {
        cal.updateSchedule(schedule.id, schedule.calendarId, changes);
        let updatedCalendarId = (changes != null && changes.calendarId != null) ? changes.calendarId : schedule.calendarId;
        let updatedSchedule = cal.getSchedule(schedule.id, updatedCalendarId);
        updatedSchedule.raw.previousRecurrenceRule = updatedSchedule.recurrenceRule;
        updatedSchedule.recurrenceRule = rrule;
        updatedSchedule.raw.hasRecurrenceRule = rrule.length > 0 ? true : false;

        updateCache(schedule, updatedSchedule);
        if(updatedSchedule.raw.hasRecurrenceRule) {
            //remove schedule
            cal.deleteSchedule(updatedSchedule.id, updatedSchedule.calendarId);
            removeFromCache(updatedSchedule);
            // add recurring
            let serialisedSchedule = serialiseICal(updatedSchedule, true);
            RecurringSchedules.push(updatedSchedule);
            CachedYearMonths.forEach(function(yearMonth) {
                cal.createSchedules(loadSchedule(updatedSchedule, yearMonth));
            });
            save(updatedSchedule, serialisedSchedule, previousCalendarId, "createRecurring");
        } else {
            let serialisedSchedule = serialiseICal(updatedSchedule, true);
            save(updatedSchedule, serialisedSchedule, previousCalendarId);
        }
    }
    refreshScheduleVisibility();
    return true;
}
function handleScheduleDeletion(event) {
    let schedule = event.schedule;
    if(schedule.raw.hasRecurrenceRule || schedule.raw.isException) {
        requestChoiceSelection("Delete", event, true);
    } else {
        removeScheduleFromCalendar(0, schedule);
    }
}
function requestChoiceSelection(method, event, includeChangeAll) {
    eventToActOn = event;
    mainWindow.postMessage({action: "requestChoiceSelection", method: method, includeChangeAll: includeChangeAll}, origin);
}
function respondToChoiceSelection(index, method) {
    if (method == "Delete") {
        removeScheduleFromCalendar(index, eventToActOn.schedule);
    } else if (method == "Edit") {
        editRecurringSchedule(index, eventToActOn);
    }
}
function editRecurringSchedule(index, event) {

    var schedule = event.schedule;
    var changes = event.changes;
    let previousCalendarId = schedule.calendarId;
    //apply changes
    cal.updateSchedule(schedule.id, schedule.calendarId, changes);
    let updatedCalendarId = (changes != null && changes.calendarId != null) ? changes.calendarId : schedule.calendarId;
    let updatedSchedule = cal.getSchedule(schedule.id, updatedCalendarId);
    let previousRRule= updatedSchedule.recurrenceRule;
    let currentRRule = rrule;
    if (!updatedSchedule.raw.isException) {
        updatedSchedule.raw.previousRecurrenceRule = updatedSchedule.recurrenceRule;
        updatedSchedule.recurrenceRule = rrule;
        updatedSchedule.raw.hasRecurrenceRule = rrule.length > 0 ? true : false;
    }
    let parentId = schedule.raw.parentId;
    //remove all instances
    removeRecurringScheduleInstances(parentId);
    let recurringIndex = RecurringSchedules.findIndex(v => v.id === parentId);
    let recurringSchedule = RecurringSchedules[recurringIndex];
    RecurringSchedules.splice(recurringIndex, 1);
    if (index == 0 || (index == 2 && updatedSchedule.start.toUTCString() == recurringSchedule.start.toUTCString())) { // all
        if(updatedSchedule.raw.isException) {
            let primarySchedule = fromException(recurringSchedule, parentId, recurringSchedule, updatedSchedule);
            primarySchedule.raw.exceptions.forEach(function(exception){ modifyException(exception, updatedSchedule); });
            recreateAndSaveSchedule(primarySchedule, previousCalendarId);
        } else {
            let primarySchedule = cloneSchedule(updatedSchedule, parentId, recurringSchedule.start, recurringSchedule.end);
            primarySchedule.raw.exceptions.forEach(function(exception){ modifyException(exception, updatedSchedule); });
            recreateAndSaveSchedule(primarySchedule, previousCalendarId);
        }
    } else if (index == 1) { //single instance
        let originalRecurrenceTime = calculateRecurrenceTime(recurringSchedule, updatedSchedule);
        updatedSchedule.id =  parentId + recurrenceIdSeparatorToken + originalRecurrenceTime.toICALString();
        if(updatedSchedule.raw.isException) {
            recurringSchedule.raw.exceptions.splice(recurringSchedule.raw.exceptions.findIndex(v => v.id === updatedSchedule.id), 1);
        } else {
            updatedSchedule.raw.parentId = parentId;
            updatedSchedule.raw.isException = true;
            updatedSchedule.recurrenceRule = '';
            updatedSchedule.raw.hasRecurrenceRule =  false;
            updatedSchedule.raw.previousRecurrenceRule = '';
            updatedSchedule.raw.exceptions = [];
        }
        recurringSchedule.raw.exceptions.push(updatedSchedule);
        recurringSchedule.id = parentId;
        recreateAndSaveSchedule(recurringSchedule, previousCalendarId);
    } else { //until
        addUntilToSchedule(recurringSchedule, updatedSchedule.start);
        let until = moment.utc(updatedSchedule.start.toUTCString());
        let filtered = recurringSchedule.raw.exceptions.filter(function(item){
            let dt = moment.utc(item.start.toUTCString());
            return dt >= until;
        });
        filtered.forEach(function(item){
            recurringSchedule.raw.exceptions.splice(recurringSchedule.raw.exceptions.findIndex(v => v.id === item.id), 1);
        });

        recreateAndSaveSchedule(recurringSchedule, previousCalendarId);
        let comp = LoadedEvents[recurringSchedule.id];
        let newId = uuidv4() + recurringEventSplitSeparatorToken
            + toICalTimeTZ(comp, updatedSchedule.start.toDate(), false).toICALString().substring(0, 8);
        let futureSchedule = updatedSchedule.raw.isException ?
            fromException(recurringSchedule, newId, updatedSchedule, updatedSchedule)
            :  cloneSchedule(updatedSchedule, newId, updatedSchedule.start, updatedSchedule.end);

        futureSchedule.recurrenceRule = currentRRule;
        futureSchedule.raw.hasRecurrenceRule =  currentRRule.length > 0;
        futureSchedule.raw.previousRecurrenceRule = previousRRule;
        futureSchedule.raw.exceptions = [];
        filtered.forEach(function(item){
            if (updatedSchedule.id != item.id) {
                modifyException(item, updatedSchedule);
                let exceptionPart = item.id.substring(item.id.indexOf(recurrenceIdSeparatorToken));
                item.id = newId + exceptionPart;
                item.raw.parentId = newId;
                futureSchedule.raw.exceptions.push(item);
            }
        });
        recreateAndSaveSchedule(futureSchedule, futureSchedule.calendarId);
    }
}
function calculateRecurrenceTime(recurringSchedule, updatedSchedule) {
    let jsDate = new Date(updatedSchedule.start.valueOf());
    jsDate.setHours(recurringSchedule.start.getHours());
    jsDate.setMinutes(recurringSchedule.start.getMinutes());
    jsDate.setSeconds(recurringSchedule.start.getSeconds());
    let comp = LoadedEvents[recurringSchedule.id];
    return toICalTimeTZ(comp, jsDate, recurringSchedule.isAllDay);
}
function recreateAndSaveSchedule(updatedSchedule, previousCalendarId) {
    if (updatedSchedule.recurrenceRule.length == 0) {
        updatedSchedule.raw.exceptions = [];
        updatedSchedule.raw.parentId = null;
        updatedSchedule.raw.previousRecurrenceRule = '';
        updatedSchedule.raw.hasRecurrenceRule = false;
    }
    let serialisedSchedule = serialiseICal(updatedSchedule, true);
    if(updatedSchedule.raw.hasRecurrenceRule) {
        RecurringSchedules.push(updatedSchedule);
        CachedYearMonths.forEach(function(yearMonth) {
            cal.createSchedules(loadSchedule(updatedSchedule, yearMonth));
        });
        save(updatedSchedule, serialisedSchedule, previousCalendarId);
    } else {
        save(updatedSchedule, serialisedSchedule, previousCalendarId, "deleteRecurring");
        cal.createSchedules([updatedSchedule]);
        addToCache(updatedSchedule);
    }
}
function fromException(parentSchedule, newId, scheduleWithTimes, exception) {
    var schedule = new ScheduleInfo();
    schedule.calendarId = exception.calendarId;
    schedule.title = exception.title;
    schedule.body = exception.body;
    schedule.location = exception.location;
    schedule.attendees = exception.attendees;
    schedule.state = exception.state;
    schedule.color = exception.color;
    schedule.bgColor = exception.bgColor;
    schedule.dragBgColor = exception.dragBgColor;
    schedule.borderColor = exception.borderColor;
    schedule.raw.memo = exception.raw.memo;
    schedule.raw.parentId = null;
    schedule.isReadOnly = exception.isReadOnly;

    schedule.id = newId;

    schedule.start = scheduleWithTimes.start;
    schedule.end = scheduleWithTimes.end;
    schedule.isAllDay = scheduleWithTimes.isAllDay;
    schedule.category = scheduleWithTimes.category;

    schedule.recurrenceRule = parentSchedule.recurrenceRule;
    schedule.raw.creator.name = parentSchedule.raw.creator.name;
    schedule.raw.hasRecurrenceRule =  parentSchedule.raw.hasRecurrenceRule;
    schedule.raw.previousRecurrenceRule = parentSchedule.raw.previousRecurrenceRule;
    schedule.raw.exceptions = parentSchedule.raw.exceptions;
    return schedule;
}
function removeRecurringScheduleInstances(parentId) {
    let repeats = [];
    CachedYearMonths.forEach(function(yearMonth) {
        let monthCache = ScheduleCache[yearMonth];
        monthCache.forEach(function(item) {
            if (item.id.startsWith(parentId + recurringEventIdSeparatorToken) ||
                item.id.startsWith(parentId + recurrenceIdSeparatorToken)) {
                repeats.push(item);
            }
        });
    });
    repeats.forEach(function(item) {
        cal.deleteSchedule(item.id, item.calendarId);
        removeFromCache(item);
    });
}
function disableToolbarButtons(newValue){
    let calendarSettings = document.getElementById("calendar-settings");
    calendarSettings.disabled = newValue;
    let calendarType = document.getElementById("dropdownMenu-calendarType");
    calendarType.disabled = newValue;
    var moveToTodayButton = document.getElementsByClassName("move-today")[0];
    moveToTodayButton.disabled = newValue;
    var navigateButtons = document.getElementsByClassName("move-day");
    for(var j=0; j < navigateButtons.length; j++) {
        navigateButtons[j].disabled = newValue;
    }
}
function shareCalendar(calendar) {
    mainWindow.postMessage({action:'shareCalendar', calendar: calendar}, origin);
}
function renameCalendar(calendar) {
    mainWindow.postMessage({action:'requestRenameCalendar', calendar: calendar}, origin);
}
function addCalendar(){
    let idAsInt = new Number(CALENDAR_ID_MY_CALENDAR) + CalendarList.length;
    let color = colorPalette[(idAsInt % 8) + 8];
    mainWindow.postMessage({action:'requestAddCalendar', newColor:color}, origin);
}
function getCalendarListItem(id) {
    for(var i=0; i < CalendarList.length;i++) {
        let item = CalendarList[i];
        if (item.id == id) {
            return item;
        }
    }
    return null;
}
function respondToCalendarRename(calendar) {
    let calendarItem = document.getElementById("cal-item-name-" + calendar.id);
    calendarItem.innerText = calendar.name;
    for(var i=0; i < CalendarList.length;i++) {
        let item = CalendarList[i];
        if (item.id == calendar.id) {
            item.name = calendar.name;
            break;
        }
    }
    replaceCalendarsInUI();
    cal.setCalendars(CalendarList);
}
function respondToCalendarColorChange(calendarName, newColor) {
    let calendarId = findCalendarByName(calendarName).id
    let calendarEl = document.getElementById("cal-item-" + calendarId);
    calendarEl.style = "border-color: " + newColor + "; background-color: " + newColor;
    for(var i=0; i < CalendarList.length;i++) {
        let item = CalendarList[i];
        if (item.id == calendarId) {
            item.bgColor = newColor;
            item.dragBgColor = newColor;
            item.borderColor = newColor;
            break;
        }
    }
    replaceCalendarsInUI();
    cal.setCalendars(CalendarList);
}
function respondToCalendarDelete(calendar) {
    let calendarItem = document.getElementById("cal-id-" + calendar.id);
    calendarItem.remove();

    let records = [];
    CachedYearMonths.forEach(function(yearMonth) {
        let monthCache = ScheduleCache[yearMonth];
        monthCache.forEach(function(item) {
            if (item.calendarId == calendar.id) {
                records.push({monthCache : monthCache, item: item});
            }
        });
    });
    records.forEach(function(record) {
        cal.deleteSchedule(record.item.id, record.item.calendarId);
        record.monthCache.splice(record.monthCache.findIndex(v => v.id === record.item.id), 1);
    });

    CalendarList.splice(CalendarList.findIndex(v => v.id === calendar.id), 1);
    replaceCalendarsInUI();
    cal.setCalendars(CalendarList); 
}

function respondToCalendarAdd(newId, newName, newColor) {

    let newCalendar = new CalendarInfo();
    newCalendar.id = newId;
    newCalendar.name = newName;
    newCalendar.shareable = true;
    newCalendar.color = '#ffffff';
    newCalendar.bgColor = newColor;
    newCalendar.dragBgColor = newColor;
    newCalendar.borderColor = newColor;
    CalendarList.push(newCalendar);

    replaceCalendarsInUI();
    cal.setCalendars(CalendarList);
    appendCalendar(newCalendar);
}
function initialiseCalendar(loadCalendarAsGuest, calendars) {
    buildUI(loadCalendarAsGuest);
    setCalendars(false, calendars);
    cal.setCalendars(CalendarList);
    setDropdownCalendarType();
    setEventListener();
    disableToolbarButtons(true);
}
function ScheduleInfo() {
    this.id = null;
    this.calendarId = null;

    this.title = null;
    this.body = null;
    this.isAllDay = false;
    this.start = null;
    this.end = null;
    this.category = '';
    this.isPrivate = false;
    this.location = null;
    this.dueDateClass = '';

    this.color = null;
    this.bgColor = null;
    this.dragBgColor = null;
    this.borderColor = null;
    this.customStyle = '';

    this.isFocused = false;
    this.isPending = false;
    this.isVisible = true;
    this.isReadOnly = false;
    this.goingDuration = 0;
    this.comingDuration = 0;
    this.recurrenceRule = '';
    this.state = CALENDAR_EVENT_ACTIVE;
    this.attendees = [];
    this.raw = {
        memo: '',
        hasToOrCc: false,
        hasRecurrenceRule: false,
        exceptions: [],
        isException: false,
        parentId: null,
        location: null,
        class: 'public', // or 'private'
        creator: {
            name: currentUsername,
            avatar: '',
            company: '',
            email: '',
            phone: ''
        }
    };
}
function addEXDateToSchedule(scheduleId, startDate) {
    var comp = LoadedEvents[scheduleId];
    let vevents = comp.getAllSubcomponents('vevent');
    let vvent = vevents[0];
    let exDate = toICalTimeTZ(comp, startDate, false);
    vvent.addPropertyWithValue('exdate', exDate);
}
function untilUTCTimeString(momentJS) {
    let currentTZ = momentJS.clone().tz(getCurrentTimeZoneId());
    let dateParts = currentTZ.toISOString().split('-').join('').split(':').join('');
    let formattedDate = dateParts.substring(0, dateParts.indexOf('.')) + "Z";//FIXME TODO not correct format according to spec
    return formattedDate;
}
//FIXME not according to spec. The format of UNTIL should match DTSTART. Page 41 https://tools.ietf.org/html/rfc5545
function addUntilToSchedule(schedule, untilTZDate) {
    var comp = LoadedEvents[schedule.id];
    let vevents = comp.getAllSubcomponents('vevent');
    let vvent = vevents[0];
    schedule.raw.previousRecurrenceRule = schedule.recurrenceRule;
    var updatedRRule = removePart("COUNT", schedule.recurrenceRule);
    updatedRRule = removePart("UNTIL", updatedRRule);
    var start = moment(untilTZDate.toDate());
    start.subtract(1, 'm');
    let formattedDate = untilUTCTimeString(start);
    schedule.recurrenceRule = updatedRRule + "UNTIL=" + formattedDate;
}
function removeScheduleFromCalendar(choiceIndex, schedule) {
    if (schedule.raw.hasRecurrenceRule || schedule.raw.isException) {
        let parentId = schedule.raw.parentId;
        removeRecurringScheduleInstances(parentId);
        let idx = RecurringSchedules.findIndex(v => v.id === parentId);
        let recurringSchedule = RecurringSchedules[idx];
        if (choiceIndex == 0 || (choiceIndex == 2 && schedule.start.toUTCString() == recurringSchedule.start.toUTCString())) { //delete everything
            deleteSchedule(recurringSchedule);
            RecurringSchedules.splice(RecurringSchedules.findIndex(v => v.id === parentId), 1);
        } else {
            if (schedule.raw.isException) {
                if (choiceIndex == 1){ //delete just this instance
                    recurringSchedule.raw.exceptions.splice(recurringSchedule.raw.exceptions.findIndex(v => v.id === schedule.id), 1);
                    addEXDateToSchedule(parentId, schedule.start);
                } else { //until
                    addUntilToSchedule(recurringSchedule, schedule.start);
                    let until = moment.utc(schedule.start.toUTCString());
                    let filtered = recurringSchedule.raw.exceptions.filter(function(item){
                        let dt = moment.utc(item.start.toUTCString());
                        return dt >= until;
                    });
                    filtered.forEach(function(item){
                        recurringSchedule.raw.exceptions.splice(recurringSchedule.raw.exceptions.findIndex(v => v.id === item.id), 1);
                    });
                }
            } else {
                if (choiceIndex == 1){ //delete just this instance
                    addEXDateToSchedule(parentId, schedule.start);
                } else { //until
                    addUntilToSchedule(recurringSchedule, schedule.start);
                }
            }
            CachedYearMonths.forEach(function(yearMonth) {
                cal.createSchedules(loadSchedule(recurringSchedule, yearMonth));
            });
            let serialisedSchedule = serialiseICal(recurringSchedule, true);
            save(recurringSchedule, serialisedSchedule, recurringSchedule.calendarId);
        }
    } else {
        cal.deleteSchedule(schedule.id, schedule.calendarId);
        removeFromCache(schedule);
        deleteSchedule(schedule);
    }
}

function displayMessage(msg) {
    mainWindow.postMessage({type:"displayMessage", message: msg}, origin);
}
function getTimeZone(iCalComp) {
	let vtimezone = iCalComp == null ? null : iCalComp.getFirstSubcomponent('vtimezone');
	if (vtimezone == null) {
	    return ICAL.Timezone.utcTimezone;
	}
    return new ICAL.Timezone(vtimezone);
}
//discussion on https://github.com/mozilla-comm/ical.js/issues/102#issuecomment-458617272
function toMoment(iCalComp, icalDateTime) {
    if (icalDateTime.zone == null) { //TODO required??
        let vtimezone = getTimeZone(iCalComp);
        icalDateTime.zone = vtimezone;
    } else if (icalDateTime.zone.tzid == 'floating') {
        icalDateTime = fromFloatingTZ(iCalComp, icalDateTime);
    }
    return moment.tz(icalDateTime.toJSDate(), normaliseTimeZoneName(icalDateTime.zone.tzid));
}
function unpackEvent(iCalComp, iCalEvent, fromImport, isSharedWithUs, calendarId) {
    let event = new Object();
    event['isAllDay'] = true;
    let id = iCalEvent.getFirstPropertyValue('uid');
    event['Id'] = id == null ? "" : id;
    let title = iCalEvent.getFirstPropertyValue('summary');
    event['title'] = title == null ? "" : title;
    let description = iCalEvent.getFirstPropertyValue('description');
    event['description'] = description == null ? "" : description;
    let location = iCalEvent.getFirstPropertyValue('location');
    event['location'] = location == null ? "" : location;
    event['start'] = toMoment(iCalComp, iCalEvent.getFirstPropertyValue('dtstart'));
    if (event['start'] != null) {
        if (iCalEvent.getFirstPropertyValue('dtstart').toICALString().indexOf('T')>-1){
            event['isAllDay'] = false;
        }
    }
    try {
        let duration = iCalEvent.getFirstPropertyValue('duration').toSeconds();
        var endDT = event['start'].clone();
        endDT = endDT.add(duration, 's');
        event['end']=  endDT;
    } catch (ex) {
	    try {
        	event['end'] = toMoment(iCalComp, iCalEvent.getFirstPropertyValue('dtend'));
    	} catch (ex2) {
    		event['end'] = event.start.clone();
	    }
    }
    let xOwner = iCalEvent.getFirstPropertyValue('x-owner');
    if (fromImport && ! isSharedWithUs) {
        event.owner = currentUsername;
    } else {
        event.owner = xOwner != null ? xOwner : '';
    }
    event['calendarId'] = calendarId;
    if (iCalEvent.getFirstPropertyValue('status') === "CANCELLED") {
        event['state'] = CALENDAR_EVENT_CANCELLED;
    } else {
        event['state'] = CALENDAR_EVENT_ACTIVE;
    }
    let allAttendees = [];
    let attendees = iCalEvent.getAllProperties('attendee');
    attendees.forEach(function(attendee) {
        allAttendees.push(attendee.getFirstValue());
    });
    event.attendees = allAttendees;
    event.recurrenceRule = iCalEvent.getFirstPropertyValue('rrule');
    let recurrenceId = iCalEvent.getFirstPropertyValue('recurrence-id');
    event.recurrenceId = recurrenceId != null ? recurrenceId.toString() : null;
    event.hasRdate = iCalEvent.hasProperty('rdate');
    event.hasExdate = iCalEvent.hasProperty('exdate');
    return event;
}
function buildCalendarEvent(eventInfo) {
    let icalComponent = new ICAL.Component(ICAL.parse(eventInfo.data));
    let vevents = icalComponent.getAllSubcomponents('vevent');
    var primary = null;
    for(var idx = 0; idx < vevents.length; idx++) {
        let vvent = vevents[idx];
        let event = unpackEvent(icalComponent, vvent, false, false, findCalendarByName(eventInfo.calendarName).id);
        let schedule = buildScheduleFromEvent(event);
        if (event.recurrenceId == null) {
            primary = schedule;
            LoadedEvents[vvent.getFirstPropertyValue('uid')] = icalComponent;
        } else {
            primary.raw.exceptions.push(schedule);
        }
    }
    return primary;
}
function toCurrentTimezone(momentDT) {
    let tzid = getCurrentTimeZoneId();
    return momentDT.clone().tz(tzid);
}
function buildScheduleFromEvent(event) {
    var schedule = new ScheduleInfo();
    if (event.recurrenceId != null) {
        schedule.id = event.Id + recurrenceIdSeparatorToken + event.recurrenceId;
        schedule.raw.parentId = event.Id;
        schedule.raw.isException = true;
    } else {
        schedule.id = event.Id;
    }
    schedule.calendarId = event.calendarId;
    schedule.title = event.title == null ? "No Title" : event.title;
    schedule.body = '';
    schedule.isReadOnly = currentUsername != event.owner ? true : false;
    schedule.isAllDay = event.isAllDay;
    schedule.category = event.isAllDay ? 'allday' : 'time';
    schedule.start = toCurrentTimezone(event.start).toDate();
    schedule.end = toCurrentTimezone(event.end).toDate();
    //schedule.isPrivate = event.isPrivate;
    schedule.location = event.location == null ? "" : event.location;
    schedule.attendees = event.attendees;
    schedule.recurrenceRule = event.recurrenceRule != null ? event.recurrenceRule.toString() : '';
    schedule.state = event.state;
    var calendar = findCalendar(event.calendarId);
    schedule.color = calendar.color;
    schedule.bgColor = calendar.bgColor;
    schedule.dragBgColor = calendar.dragBgColor;
    schedule.borderColor = calendar.borderColor;
    schedule.raw.memo = event.description == null ? "" : event.description;
    schedule.raw.creator.name = event.owner;
    schedule.raw.hasRecurrenceRule =  schedule.recurrenceRule.length > 0;
    schedule.raw.previousRecurrenceRule = schedule.recurrenceRule;
    return schedule;
}
function modifyException(exception, updatedSchedule) {
    exception.calendarId = updatedSchedule.calendarId;
    exception.title = updatedSchedule.title;
    exception.body = updatedSchedule.body;
    exception.location = updatedSchedule.location;
    exception.state = updatedSchedule.state;
    exception.color = updatedSchedule.color;
    exception.bgColor = updatedSchedule.bgColor;
    exception.dragBgColor = updatedSchedule.dragBgColor;
    exception.borderColor = updatedSchedule.borderColor;
    exception.raw.memo = updatedSchedule.raw.memo;
}
//only copying references. Is that right?
function cloneSchedule(scheduleOrig, newId, start, end) {
    var schedule = new ScheduleInfo();
    schedule.id = newId;
    schedule.calendarId = scheduleOrig.calendarId;
    schedule.title = scheduleOrig.title;
    schedule.body = scheduleOrig.body;
    schedule.isReadOnly = scheduleOrig.isReadOnly;
    schedule.isAllDay = scheduleOrig.isAllDay;
    schedule.category = scheduleOrig.category;
    schedule.start = start;
    schedule.end = end;
    //schedule.isPrivate = scheduleOrig.isPrivate;
    schedule.location = scheduleOrig.location;
    schedule.attendees = scheduleOrig.attendees;
    schedule.recurrenceRule = scheduleOrig.recurrenceRule;
    schedule.raw.previousRecurrenceRule = scheduleOrig.raw.previousRecurrenceRule;
    schedule.state = scheduleOrig.state;
    schedule.color = scheduleOrig.color;
    schedule.bgColor = scheduleOrig.bgColor;
    schedule.dragBgColor = scheduleOrig.dragBgColor;
    schedule.borderColor = scheduleOrig.borderColor;
    schedule.raw.memo = scheduleOrig.raw.memo;
    schedule.raw.creator.name = scheduleOrig.raw.creator.name;
    schedule.raw.hasRecurrenceRule =  scheduleOrig.raw.hasRecurrenceRule;
    schedule.raw.parentId = scheduleOrig.id;
    schedule.raw.exceptions = scheduleOrig.raw.exceptions;
    return schedule;
}

function removeFromCache(schedule) {
    let dt = moment.utc(schedule.start.toUTCString());
    let yearMonth = dt.year() * 12 + dt.month();
    let monthCache = ScheduleCache[yearMonth];
    if (monthCache != null) {
        monthCache.splice(monthCache.findIndex(v => v.id === schedule.id), 1);
    }
}
function addToCache(newSchedule) {
    let dt = moment.utc(newSchedule.start.toUTCString());
    let newYearMonth = dt.year() * 12 + dt.month();
    let monthCache = ScheduleCache[newYearMonth];
    if (monthCache != null) {
        monthCache.push(newSchedule);
    }
}
function updateCache(oldSchedule, newSchedule) {
    if (oldSchedule != null) {
        let dt = moment.utc(oldSchedule.start.toUTCString());
        let oldYearMonth = dt.year() * 12 + dt.month();
        let monthCache = ScheduleCache[oldYearMonth];
        if (monthCache != null) {
            monthCache.splice(monthCache.findIndex(v => v.id === oldSchedule.id), 1);
        }
    }
    if (newSchedule != null) {
        let newDt = moment.utc(newSchedule.start.toUTCString());
        let newYearMonth = newDt.year() * 12 + newDt.month();
        let monthCache = ScheduleCache[newYearMonth];
        if (monthCache != null) {
            monthCache.push(newSchedule);
        }
    }
}
function importICSFile(contents, username, isSharedWithUs, loadCalendarAsGuest, calendarName, showConfirmation) {
    currentUsername = username;
    if (loadCalendarAsGuest) {
        var yearMonth = currentMoment.year() * 12 + currentMoment.month();
        load([], [], [], [], yearMonth, "unknown");
    }
    let icalComponent = new ICAL.Component(ICAL.parse(contents));
    let vevents = icalComponent.getAllSubcomponents('vevent');
    let scheduleMap = {};
    let schedules = [];
    for(var idx = 0; idx < vevents.length; idx++) {
        let vvent = vevents[idx];
        let event = unpackEvent(icalComponent, vvent, true, isSharedWithUs, findCalendarByName(calendarName).id);
        if (validateEvent(event)) {
            let schedule = buildScheduleFromEvent(event);
            if (event.recurrenceId == null) {
                scheduleMap[schedule.id] = schedule;
                schedules.push(schedule);
                LoadedEvents[schedule.id] = buildComponentFromEvent(icalComponent, vvent);
            } else {
                let origSchedule = scheduleMap[schedule.raw.parentId];
                if (origSchedule != null) {
                    origSchedule.raw.exceptions.push(schedule);
                }
            }
        }
    }
    let allEvents = [];
    let allEventSummaries = [];
    for(var i = 0 ; i < schedules.length; i++) {
        let schedule = schedules[i];
        let output = serialiseICal(schedule, false);
        if (schedule.raw.hasRecurrenceRule) {
            RecurringSchedules.push(schedule);
            if (cal != null) {// could be headless import
                CachedYearMonths.forEach(function(yearMonth) {
                    cal.createSchedules(loadSchedule(schedule, yearMonth));
                });
            }
        } else {
            if (cal != null) {// could be headless import
                cal.createSchedules([schedule]);
                addToCache(schedule);
            }
        }
        let dt = moment.utc(schedule.start.toUTCString());
        if (!loadCalendarAsGuest) {
            let year = dt.year();
            let month = dt.month() + 1;
            let recurringText = schedule.raw.hasRecurrenceRule ? ' (Recurring: ' + schedule.recurrenceRule + ')' : '';
            let stateText = schedule.state == CALENDAR_EVENT_CANCELLED ? 'CANCELLED ' : '';
            let eventSummary = {datetime: moment(schedule.start.toUTCString()).toLocaleString(), title: stateText + schedule.title + recurringText };
            allEvents.push({calendarName: calendarName, year: year, month: month, Id: schedule.id, item:output,
                    summary: eventSummary, isRecurring: schedule.raw.hasRecurrenceRule});
        }
    }
    if (loadCalendarAsGuest) {
        removeSpinner();
        disableToolbarButtons(false);
    }
    if (allEvents.length > 0) {
        mainWindow.postMessage({items:allEvents, showConfirmation: showConfirmation, type:"saveAll"}, origin);
    }
    if (cal != null) { // could be headless import
        refreshScheduleVisibility();
    }
}
function isEmptyValue(val) {
    return val == null || val.trim().length == 0;
}
function eventSameDay(event) {
    return isSameDayMomentJS(event.isAllDay, event.start, event.end);
}
function isSameDayMomentJS(isAllDay, start, end) {
    if (start.year() == end.year()
        && start.month() == end.month() ){
        if (start.date() == end.date()) {
            return true;
        } else {
            if (isAllDay) {
                let diffDays = start.diff(end, 'days');
                if (diffDays == -1 && start.hours() == 0 && start.hours() == end.hours()
                    && start.minutes() == 0 && start.minutes() == end.minutes()
                    && start.seconds() == 0 && start.seconds() == end.seconds()) {
                    return true;
                }
            }
        }
    }
    return false;
}
function scheduleSameDay(schedule) {
    let isAllDay = schedule.isAllDay;
    let start = schedule.start;
    let end = schedule.end;
    if (start.getFullYear() == end.getFullYear()
        && start.getMonth() == end.getMonth() ){
        if (start.getDate() == end.getDate()) {
            return true;
        } else {
            if (isAllDay) {
                let momentStart = moment(start);
                let momentEnd = moment(end);
                let diffDays = momentStart.diff(momentEnd, 'days');
                if (diffDays == -1 && momentStart.hours() == 0 && momentStart.hours() == momentEnd.hours()
                    && momentStart.minutes() == 0 && momentStart.minutes() == momentEnd.minutes()
                    && momentStart.seconds() == 0 && momentStart.seconds() == momentEnd.seconds()) {
                    return true;
                }
            }
        }
    }
    return false;
}
function scheduleSameMonth(oldScheduleStart, newScheduleStart) {
    let oldStart = moment.utc(oldScheduleStart.toUTCString());
    let newStart = moment.utc(newScheduleStart.toUTCString());
    return oldStart.year() == newStart.year() && oldStart.month() == newStart.month();
}
function validateEvent(event) {
    if (isEmptyValue(event.Id) || isEmptyValue(event.title) || event.start == null || event.end == null) {
        showImportError("Event missing all required fields: UID, SUMMARY, DTSTART, DTEND. UID:" + event.Id);
        return false;
    }
    if (!eventSameDay(event)) {
        showImportError("Only single day events supported");
        return false;
    }
    if (event.recurrenceRule != null) {
        let frequency = extractPartFromRecurrenceRule(event.recurrenceRule.toString(),
                "FREQ",function(val){return frequencyValidator(val) ? val : null;});
        if (frequency == null) {
            showImportError("Frequency specified not supported. Supported Frequencies are: DAILY, WEEKLY, MONTHLY, YEARLY. UID:" + event.Id);
            return false;
        }
    }
    if (event.recurrenceId != null) {
        if (event.hasRdate || event.hasExdate || event.recurrenceRule != null) {
            showImportError("Calendar does not support event containing both a recurrenceId and either a rdate, exdate or rrule. UID:" + event.Id);
        }
    }
    return true;
}
function buildMonthScheduleCache(yearMonth) {
    let monthCache = ScheduleCache[yearMonth];
    if (monthCache == null) {
        CachedYearMonths.push(yearMonth);
        ScheduleCache[yearMonth] = monthCache = [];
    }
    return monthCache;
}
function loadAdditional(currentMonthEvents, yearMonth) {
    let monthCache = buildMonthScheduleCache(yearMonth);
    let currentYearMonth = currentMoment.year() * 12 + currentMoment.month();
    for (var i = 0; i < currentMonthEvents.length; i++) {
        let schedule = buildCalendarEvent(currentMonthEvents[i]);
        monthCache.push(schedule);
        cal.createSchedules([schedule]);
    }
    for (var i = 0; i < RecurringSchedules.length; i++) {
        cal.createSchedules(loadSchedule(RecurringSchedules[i], yearMonth));
    }
    refreshScheduleVisibility();
    setRenderRangeText();
    removeSpinner();
    disableToolbarButtons(false);
}
function loadArbitrarySchedule(schedule, yearMonth) {
    cal.createSchedules(loadSchedule(schedule, yearMonth));
    refreshScheduleVisibility();
    setRenderRangeText();
    removeSpinner();
}

function calcStartOfNextMonth(icalComponent, year, month) {
        if (month == 12) {
            year = year + 1;
            month = 0;
        }
        let timeZone = getTimeZone(icalComponent);
        var dateTime = new ICAL.Time({
          year: year,
          month: month + 1,
          day: 1,
          hour: 0,
          minute: 0,
          second: 0,
          isDate: true
        }, timeZone);
        return dateTime;
}
function fromFloatingTZ(icalComponent, icalTime) {
        let timeZone = getTimeZone(icalComponent);
        var dateTime = new ICAL.Time({
          year: icalTime.year,
          month: icalTime.month,
          day: icalTime.day,
          hour: icalTime.hour,
          minute: icalTime.minute,
          second: icalTime.second,
          isDate: icalTime.isDate
        }, timeZone);
        return dateTime;
}
function calcRangeStart(icalComponent, schedule, month, year) {
        let day = month == schedule.start.getMonth() + 1 && year == schedule.start.getFullYear() ? schedule.start.getDate() : 1;
        let timeZone = getTimeZone(icalComponent);
        var dateTime = new ICAL.Time({
          year: year,
          month: month,
          day: day,
          hour: schedule.start.getHours(),
          minute: schedule.start.getMinutes(),
          second: schedule.start.getSeconds(),
          isDate: schedule.isAllDay
        }, timeZone);
        return dateTime;
}
function loadSchedule(schedule, yearMonth) {
    let monthCache = buildMonthScheduleCache(yearMonth);
    let year = Math.floor(yearMonth / 12);
    let month = yearMonth % 12;
    var icalComponent = LoadedEvents[schedule.id];
    let vevents = icalComponent.getAllSubcomponents('vevent');
    let vvent = vevents[0];
    let newSchedules = [];
    if (vvent.hasProperty('rrule') || vvent.hasProperty('rdate')){
        var rangeEnd = calcStartOfNextMonth(icalComponent, year, month + 1);
        if (schedule.raw.hasRecurrenceRule) {
            let rule = ICAL.Recur.fromString(schedule.recurrenceRule);
            if (rule.until != null) {
                if (rule.until.compare(rangeEnd) < 0) {
                    rangeEnd = rule.until;
                }
            }
        }
        let dtStart = vvent.getFirstPropertyValue('dtstart');
        if (dtStart.compare(rangeEnd) >= 0) {
            return [];
        }
        let rangeStart = calcRangeStart(icalComponent, schedule, month + 1, year);
        try {
            const icalExpander = new IcalExpander({ ics: icalComponent});
            //console.log("start:" + rangeStart.toJSDate() + " rangeEnd:" + rangeEnd.toJSDate());
            const events = icalExpander.between(rangeStart.toJSDate(), rangeEnd.toJSDate());
            for(var i = 0; i < events.occurrences.length; i++) {
                let next = events.occurrences[i];
                if (next.startDate.compare(rangeStart) >= 0
                    && (next.startDate.compare(rangeEnd) <= 0
                        || ( rangeEnd.isDate &&  next.startDate.toJSDate().getMonth() == rangeStart.toJSDate().getMonth()
                            && isSameDayMomentJS(schedule.isAllDay, toMoment(icalComponent, next.startDate), toMoment(icalComponent, rangeEnd)))
                        )
                    ) {
                    //console.log(next.toString());
                    let newSchedule = recalculateSchedule(icalComponent, schedule, vvent, next.startDate);//, next.recurrenceId);
                    newSchedules.push(newSchedule);
                    monthCache.push(newSchedule);
                }
            }
        } catch (ex) {
            let msg = "Unable to parse recurring event: "
                + dt.toLocaleString() + ' - ' + schedule.title
                + " (" + schedule.recurrenceRule + ").";
            console.log(msg);
            console.log(ex);
            //displayMessage(msg);
        }
        let exceptions = filterSchedules(schedule.raw.exceptions, yearMonth);
        exceptions.forEach(function(exception) {
            monthCache.push(exception);
            newSchedules.push(exception);
        });
    } else {
        monthCache.push(schedule);
        newSchedules.push(schedule);
    }
    return newSchedules;
}
function recalculateSchedule(iCalComp, schedule, iCalEvent, nextDtStart) {
    let dtStart = toMoment(iCalComp, iCalEvent.getFirstPropertyValue('dtstart'));
    var start = toMoment(iCalComp, nextDtStart);
    var end;
    try {
        let duration = iCalEvent.getFirstPropertyValue('duration').toSeconds();
        end = start.clone().add(duration, 's');
    } catch (ex) {
        try {
            let firstEnd = toMoment(iCalComp, iCalEvent.getFirstPropertyValue('dtend'));
            let diff = firstEnd.toDate().getTime() - dtStart.toDate().getTime();
            end = start.clone().add(diff / 1000, 's');
        } catch (ex2) {
            end = event.start.clone();
        }
    }
    let newId = schedule.id + recurringEventIdSeparatorToken + nextDtStart.toICALString().substring(0, 8);
    //console.log(newId +" " + start);
    return cloneSchedule(schedule, newId, start.toDate(), end.toDate());
}

function load(previousMonthEvents, currentMonthEvents, nextMonthEvents, recurringEvents, yearMonth, username) {
    currentUsername = username;
    let previousYearMonth = yearMonth - 1;
    let pYear = Math.floor(previousYearMonth / 12);
    let pMonth = previousYearMonth % 12;
    let previousMonthCache = buildMonthScheduleCache(pYear * 12 + pMonth);
    var schedules = [];
    for (var i = 0; i < previousMonthEvents.length; i++) {
        let schedule = buildCalendarEvent(previousMonthEvents[i]);
        schedules.push(schedule);
        previousMonthCache.push(schedule);
    }
    cYear = Math.floor(yearMonth / 12);
    cMonth = yearMonth % 12;
    let currentMonthCache = buildMonthScheduleCache(cYear * 12 + cMonth);
    for (var i = 0; i < currentMonthEvents.length; i++) {
        let schedule = buildCalendarEvent(currentMonthEvents[i]);
        schedules.push(schedule);
        currentMonthCache.push(schedule);
    }
    let nextYearMonth = yearMonth + 1;
    nYear = Math.floor(nextYearMonth / 12);
    nMonth = nextYearMonth % 12;
    let nextMonthCache = buildMonthScheduleCache(nYear * 12 + nMonth);
    for (var i = 0; i < nextMonthEvents.length; i++) {
        let schedule = buildCalendarEvent(nextMonthEvents[i]);
        schedules.push(schedule);
        nextMonthCache.push(schedule);
    }
    cal.createSchedules(schedules);
    for (var i = 0; i < recurringEvents.length; i++) {
        let schedule = buildCalendarEvent(recurringEvents[i]);
        RecurringSchedules.push(schedule);
        cal.createSchedules(loadSchedule(schedule, previousYearMonth));
        cal.createSchedules(loadSchedule(schedule, yearMonth));
        cal.createSchedules(loadSchedule(schedule, nextYearMonth));
    }
    refreshScheduleVisibility();
    setRenderRangeText();
    removeSpinner();
    disableToolbarButtons(false);
}
function filterSchedules(schedules, yearMonth) {
    let filtered = schedules.filter(function(schedule){
        let dt = moment.utc(schedule.start.toUTCString());
        return dt.year() * 12 + dt.month() == yearMonth;
    });
    return filtered;
}
function deleteSchedule(schedule) {
    let Id = schedule.id;
    let dt = moment.utc(schedule.start.toUTCString());
    let year = dt.year();
    let month = dt.month() + 1;
    let calendarName = findCalendar(schedule.calendarId).name;
    mainWindow.postMessage({ calendarName: calendarName, year: year, month: month, Id: Id, isRecurring: schedule.raw.hasRecurrenceRule, type:"delete"}, origin);
}

function displaySpinner() {
    mainWindow.postMessage({type:"displaySpinner"}, origin);
}

function removeSpinner() {
    mainWindow.postMessage({type:"removeSpinner"}, origin);
}

function timestamp(jsDate) {
    let dt = moment.utc(jsDate.toUTCString());
    var dateTime = new ICAL.Time({
      year: dt.year(),
      month:  dt.month() +1,
      day: dt.date(),
      hour: dt.hour(),
      minute: dt.minute(),
      second: dt.second(),
      isDate: false
    }, ICAL.Timezone.utcTimezone);
    return dateTime;
}
function save(schedule, serialisedSchedule, previousCalendarId, action) {
    //let isPrivate = schedule.isPrivate;
    //let state = schedule.state;
    let dt = moment.utc(schedule.start.toUTCString());
    let year = dt.year();
    let month = dt.month() + 1;
    let calendarName = findCalendar(schedule.calendarId).name;
    let previousCalendarName = findCalendar(previousCalendarId).name;
    let saveAction = action == null ? "" : action;
    mainWindow.postMessage({ calendarName: calendarName, year: year, month: month, Id: schedule.id,
        item:serialisedSchedule, previousCalendarName: previousCalendarName, isRecurring: schedule.raw.hasRecurrenceRule, action: saveAction, type:"save"}, origin);
}
function upgradeICAL(comp, schedule) {
    let id = comp.getFirstPropertyValue('prodid');
    return id == calendarVersions[0];
//  let id = comp.getFirstPropertyValue('prodid');
//    return schedule.raw.hasRecurrenceRule; //initial version was all in UTC - no good for recurring events
}
function serialiseICal(schedule, updateTimestamp) {
    var comp = LoadedEvents[schedule.id];
    if (comp != null && ! upgradeICAL(comp, schedule)) {
        let vevents = comp.getAllSubcomponents('vevent');
        for(var j = 1; j < vevents.length; j++) {
            let currentEvent = vevents[j];
            if (currentEvent.getFirstPropertyValue('recurrence-id') != null) {
                comp.removeSubcomponent(currentEvent);
            }
        }
        comp.updatePropertyWithValue('prodid', calendarVersions[currentVersion]);
        comp.updatePropertyWithValue('version', '2.0');
        let vvent = vevents[0];
        vvent.updatePropertyWithValue('summary', schedule.title);
        vvent.updatePropertyWithValue('description', schedule.raw.memo);
        vvent.updatePropertyWithValue('location', schedule.location);
        if (updateTimestamp || vvent.getFirstPropertyValue("dtstamp") == null) {
            vvent.updatePropertyWithValue('dtstamp', timestamp(new Date()));
        }
        if (schedule.isAllDay) {
            let allDayStart = toICalTimeTZ(comp, schedule.start, schedule.isAllDay);
            vvent.updatePropertyWithValue('dtstart', allDayStart);
            vvent.updatePropertyWithValue('dtend', allDayStart);
        } else {
            vvent.updatePropertyWithValue('dtstart', toICalTimeTZ(comp, schedule.start, schedule.isAllDay));
            vvent.updatePropertyWithValue('dtend', toICalTimeTZ(comp, schedule.end, schedule.isAllDay));
        }
        vvent.updatePropertyWithValue('x-owner', schedule.raw.creator.name);
        if(schedule.state == CALENDAR_EVENT_CANCELLED) { //CANCELLED
            vvent.updatePropertyWithValue('status', "CANCELLED");
        } else {
            vvent.removeProperty('status');
        }
        if (schedule.raw.hasRecurrenceRule) {
            vvent.updatePropertyWithValue('rrule', ICAL.Recur.fromString(schedule.recurrenceRule));
        } else {
            vvent.removeProperty('rrule');
        }

        schedule.raw.exceptions.forEach(function(exception) {
            comp.addSubcomponent(buildEventFromSchedule(comp, exception));
        });
    } else {
        comp = emptyComponent(getCurrentTimeZoneId());
        let vevent = buildEventFromSchedule(comp, schedule);
        comp.addSubcomponent(vevent);
        schedule.raw.exceptions.forEach(function(exception) {
            comp.addSubcomponent(buildEventFromSchedule(comp, exception));
        });
        LoadedEvents[schedule.id] = comp;
    }
    return comp.toString();
}
function getCurrentTimeZoneId() {
    var tzid = null;
    try {
        tzid = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
        tzid = 'UTC';
    }
    return tzid;
}
function emptyComponent(tzId) {
    var text = null;
    if (tzId == null || tzId =='UTC') {
        text = 'BEGIN:VCALENDAR\nPRODID:' + calendarVersions[currentVersion] + '\nVERSION:2.0\nEND:VCALENDAR';
    } else {
        let tzText = getTimeZoneText(tzId);
        const icsTimezone = 'BEGIN:VTIMEZONE\r\nTZID:' + tzId + '\r\n' + tzText + '\r\nEND:VTIMEZONE';
        text = 'BEGIN:VCALENDAR\nPRODID:' + calendarVersions[currentVersion] + '\nVERSION:2.0\n' + icsTimezone + '\nEND:VCALENDAR';
    }
    const comp = new ICAL.Component(ICAL.parse(text));
    return comp;
}
function buildComponentFromEvent(icalComponent, vevent) {
    let timeZone = getTimeZone(icalComponent);
    let comp = emptyComponent(timeZone.tzid)
    comp.addSubcomponent(vevent);
    return comp;
}
//Calendar internally uses TZDate
//schedule is originally set with a JS Date, but calendar updates it to be a TZDate
function toJSDate(dateTime) {
    try {
        return dateTime.toDate();
    } catch (e) {
        return dateTime;
    }
}
function toICalTimeTZ(icalComp, tzDate, isAllDay) {
    let jsDate = toJSDate(tzDate);
    let dt = moment(jsDate);
    let timeZone = getTimeZone(icalComp);
    let destTZ = dt.clone().tz(normaliseTimeZoneName(timeZone.tzid));
    if (isAllDay && jsDate.getDate() != destTZ.date()) {
        if (jsDate > destTZ.toDate()) {
            destTZ.add(1, 'days');
        } else {
            destTZ.subtract(1, 'days');
        }
    }
    var dateTime = new ICAL.Time({
      year: destTZ.year(),
      month:  destTZ.month() +1,
      day: destTZ.date(),
      hour: destTZ.hour(),
      minute: destTZ.minute(),
      second: destTZ.second(),
      isDate: isAllDay
    }, timeZone);
    return dateTime;
}
function buildEventFromSchedule(icalComp, schedule) {
    let vevent = new ICAL.Component('vevent'),
    event = new ICAL.Event(vevent);
    event.uid = schedule.raw.isException ? schedule.raw.parentId : schedule.id;
    event.summary = schedule.title;
    event.description = schedule.raw.memo;
    event.location = schedule.location;
    if (schedule.isAllDay) {
        event.startDate = toICalTimeTZ(icalComp, schedule.start, schedule.isAllDay);
        event.endDate = event.startDate;
    } else {
        event.startDate = toICalTimeTZ(icalComp, schedule.start, schedule.isAllDay);
        event.endDate = toICalTimeTZ(icalComp, schedule.end, schedule.isAllDay);
    }
    vevent.addPropertyWithValue('x-owner', schedule.raw.creator.name);
    vevent.addPropertyWithValue('dtstamp', timestamp(new Date()));
    if (schedule.state == CALENDAR_EVENT_CANCELLED) { //CANCELLED
        vevent.addPropertyWithValue('status', "CANCELLED");
    }
    if (schedule.raw.hasRecurrenceRule) {
        vevent.addPropertyWithValue('rrule', ICAL.Recur.fromString(schedule.recurrenceRule));
    }
    if (schedule.raw.isException) {
        let recurrenceIDStr = schedule.id.substring(schedule.id.indexOf(recurrenceIdSeparatorToken) + 1);
        let timestamp = moment(recurrenceIDStr);
        let recurrenceID = toICalTimeTZ(icalComp, timestamp.toDate(), schedule.isAllDay);
        vevent.addPropertyWithValue('recurrence-id', recurrenceID);
    }
    return vevent;
}
function CalendarInfo() {
    this.id = null;
    this.name = null;
    this.shareable = false;
    this.checked = true;
    this.color = null;
    this.bgColor = null;
    this.borderColor = null;
    this.dragBgColor = null;
}

function findCalendar(id) {
    var found;
    CalendarList.forEach(function(calendar) {
        if (calendar.id === id) {
            found = calendar;
        }
    });
    return found || CalendarList[0];
}

function findCalendarByName(name) {
    var found;
    CalendarList.forEach(function(calendar) {
        if (calendar.name === name) {
            found = calendar;
        }
    });
    return found || CalendarList[0];
}

function setCalendars(headless, calendars) {
    var id = CALENDAR_ID_MY_CALENDAR;

    if (calendars.length == 0) {
        var calendar = new CalendarInfo();
        calendar.id = String(id);
        calendar.name = "My Calendar";
        calendar.color = '#ffffff';
        calendar.bgColor = '#00a9ff';
        calendar.dragBgColor = '#00a9ff';
        calendar.borderColor = '#00a9ff';
        CalendarList.push(calendar);
    } else {
        for(var i = 0; i < calendars.length; i++) {
            var calendar = new CalendarInfo();
            calendar.name = calendars[i].name;
            calendar.owner = calendars[i].owner;
            let shareable = calendars[i].shareable;
            calendar.shareable = shareable == null ? false : true;
            calendar.id = String(id++);
            calendar.color = '#ffffff';
            let color = calendars[i].color == null ? '#00a9ff' : calendars[i].color;
            calendar.bgColor = color;
            calendar.dragBgColor = color;
            calendar.borderColor = color;
            CalendarList.push(calendar);
        }
    }
    if (!headless) {
        replaceCalendarsInUI();
    }
}
    function replaceCalendarsInUI() {
        var calendarList = document.getElementById('calendarList');
        var html = [];
        CalendarList.forEach(function(calendar) {
                html.push('<div class="lnb-calendars-item"><label>' +
                    '<input type="checkbox" class="tui-full-calendar-checkbox-round" value="' + calendar.id + '" checked>' +
                    '<span style="border-color: ' + calendar.borderColor + '; background-color: ' + calendar.borderColor + ';"></span>' +
                    '</label><label><span id="cal-' + calendar.id + '" style="cursor:text;"></span>' +
                    '</label></div>'
                );
        });
        calendarList.innerHTML = html.join('\n');
        CalendarList.forEach(function(calendar) {
            let calendarEl = document.getElementById('cal-' + calendar.id);
            let calName = calendar.name;
            calendarEl.innerText = calName;
            calendarEl.onclick=function(e) {
                let checkbox = target = e.target.parentElement.parentElement.firstElementChild.firstElementChild; //from calendar name to calendar checkbox
                checkbox.checked = !checkbox.checked;
                onChangeCalendars(e);
            };

        });
        $('#lnb-calendars').on('change', onChangeCalendars);
    }
    /**
     * Get time template for time and all-day
     * @param {Schedule} schedule - schedule
     * @param {boolean} isAllDay - isAllDay or hasMultiDates
     * @returns {string}
     */
    function getTimeTemplate(schedule, isAllDay) {
        var html = [];
        var start = moment(schedule.start.toUTCString());
        if (!isAllDay) {
            html.push('<strong>' + start.format('HH:mm') + '</strong> ');
        }
        if (schedule.isPrivate) {
            html.push('<span class="calendar-font-icon ic-lock-b"></span>');
            html.push(' Private');
        } else {
            if (schedule.isReadOnly) {
                html.push('<span class="calendar-font-icon ic-readonly-b"></span>');
            } else if (schedule.recurrenceRule) {
                html.push('<span class="calendar-font-icon ic-repeat-b"></span>');
            } else if (schedule.attendees.length) {
                html.push('<span class="calendar-font-icon ic-user-b"></span>');
            } else if (schedule.location) {
                html.push('<span class="calendar-font-icon ic-location-b"></span>');
            }
            html.push(' ' + schedule.title);
        }

        return html.join('');
    }

    //https://stackoverflow.com/questions/105034/how-to-create-guid-uuid
    function uuidv4() {
      let uuid = ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      ).split("-").join("");
      return uuid.substring(0, 16);
    }
    function buildNewSchedule(scheduleData) {
        var calendar = scheduleData.calendar || findCalendar(scheduleData.calendarId);
        var schedule = new ScheduleInfo();
        schedule.id = uuidv4();
        schedule.title = scheduleData.title;
        schedule.isAllDay = scheduleData.isAllDay;
        schedule.start = scheduleData.start;
        schedule.end = scheduleData.end;
        schedule.category = scheduleData.isAllDay ? 'allday' : 'time';
        schedule.location = scheduleData.location;
        schedule.recurrenceRule = rrule;
        schedule.raw.class = scheduleData.raw['class'];
        schedule.raw.memo = scheduleData.raw['memo'];
        schedule.raw.hasRecurrenceRule = rrule.length > 0 ? true : false;
        schedule.raw.previousRecurrenceRule = rrule;
        schedule.raw.creator.name = currentUsername;

        schedule.state = scheduleData.state;
        schedule.calendarId = calendar.id;
        schedule.color = calendar.color;
        schedule.bgColor = calendar.bgColor;
        schedule.borderColor = calendar.borderColor;
        return schedule;
    }

    function onChangeCalendars(e) {
        let target = e.target;
        if(e.target.value == null) {
            target = e.target.parentElement.parentElement.firstElementChild.firstElementChild; //from calendar name to calendar checkbox
        }
        var calendarId = target.value;
        var checked = target.checked;
        var viewAll = document.querySelector('.lnb-calendars-item input');
        var calendarElements = Array.prototype.slice.call(document.querySelectorAll('#calendarList input'));
        var allCheckedCalendars = true;

        if (calendarId === 'all') {
            allCheckedCalendars = checked;

            calendarElements.forEach(function(input) {
                var span = input.parentNode;
                input.checked = checked;
                span.style.backgroundColor = checked ? span.style.borderColor : 'transparent';
            });

            CalendarList.forEach(function(calendar) {
                calendar.checked = checked;
            });
        } else {
            findCalendar(calendarId).checked = checked;

            allCheckedCalendars = calendarElements.every(function(input) {
                return input.checked;
            });

            if (allCheckedCalendars) {
                viewAll.checked = true;
            } else {
                viewAll.checked = false;
            }
        }

        refreshScheduleVisibility();
    }

function getDataAction(target) {
  return target.dataset ? target.dataset.action : target.getAttribute('data-action');
}

function setDropdownCalendarType() {
  var calendarTypeName = document.getElementById('calendarTypeName');
  //var calendarTypeIcon = document.getElementById('calendarTypeIcon');
  var options = cal.getOptions();
  var type = cal.getViewName();
  var iconClassName;

  if (type === 'day') {
    type = 'Daily';
    iconClassName = 'calendar-icon ic_view_day';
  } else if (type === 'week') {
    type = 'Weekly';
    iconClassName = 'calendar-icon ic_view_week';
  } else if (options.month.visibleWeeksCount === 2) {
    type = '2 weeks';
    iconClassName = 'calendar-icon ic_view_week';
  } else if (options.month.visibleWeeksCount === 3) {
    type = '3 weeks';
    iconClassName = 'calendar-icon ic_view_week';
  } else {
    type = 'Monthly';
    iconClassName = 'calendar-icon ic_view_month';
  }

  calendarTypeName.innerHTML = type;
  //calendarTypeIcon.className = iconClassName;
}

function onClickMenu(e) {
  var target = $(e.target).closest('a[role="menuitem"]')[0];
  var action = getDataAction(target);
  var options = cal.getOptions();
  var viewName = '';

  switch (action) {
    case 'toggle-daily':
      viewName = 'day';
      break;
    case 'toggle-weekly':
      viewName = 'week';
      break;
    case 'toggle-monthly':
      options.month.visibleWeeksCount = 0;
      viewName = 'month';
      break;
    default:
      break;
  }

  cal.setOptions(options, true);
  cal.changeView(viewName, true);

  setDropdownCalendarType();
  setRenderRangeText();
}

function onClickNavi(e) {
    var action = getDataAction(e.target);
    let viewName = cal.getViewName();
    let wasMoment = currentMoment.clone();
    if (action == 'move-today') {
        let today = moment();
        cal.today();
        if (wasMoment.month() == currentMoment.month()) {
          setRenderRangeText();
        } else {
          reload(today, today);
        }
    } else {
        if (viewName === 'day') {
              switch (action) {
                case 'move-prev':
                    currentMoment.subtract(1, 'days');
                    cal.prev();
                    break;
                case 'move-next':
                    currentMoment.add(1, 'days');
                    cal.next();
                    break;
              }
        }else if (viewName === 'week') {
              switch (action) {
                case 'move-prev':
                    currentMoment.subtract(1, 'weeks');
                    cal.prev();
                    break;
                case 'move-next':
                    currentMoment.add(1, 'weeks');
                    cal.next();
                    break;
              }
        }else if(viewName === 'month') {
                switch (action) {
                  case 'move-prev':
                      currentMoment.subtract(1, 'months');
                      cal.prev();
                      break;
                  case 'move-next':
                      currentMoment.add(1, 'months');
                      cal.next();
                      break;
                }
        }
        if (wasMoment.month() == currentMoment.month()) {
            setRenderRangeText();
        } else {
            let toLoadMonth = currentMoment.clone();
            if (wasMoment.isSameOrAfter(currentMoment)) {
                toLoadMonth.subtract(1, 'months');
                reload(currentMoment, toLoadMonth);
            } else {
                toLoadMonth.add(1, 'months');
                reload(currentMoment, toLoadMonth);
            }
        }
    }
}

function reload(currentMoment, toLoadMonth) {
    let cachedList = ScheduleCache[toLoadMonth.year() * 12 + toLoadMonth.month()];
    if (cachedList == null) {
        displaySpinner();
        if (loadCalendarAsGuest) {
            let yearMonth = toLoadMonth.year() * 12 + toLoadMonth.month();
            loadAdditional([], yearMonth);
        } else {
            disableToolbarButtons(true);
            mainWindow.postMessage({type:"loadAdditional", year: toLoadMonth.year(), month: (toLoadMonth.month() + 1)},
                origin);
        }
    } else {
        refreshScheduleVisibility();
        setRenderRangeText();
    }
}

function setRenderRangeText() {
  var renderRange = document.getElementById('renderRange');
  var options = cal.getOptions();
  var viewName = cal.getViewName();
  var html = [];
  if (viewName === 'day') {
    html.push(moment(cal.getDate().getTime()).format('YYYY.MM.DD'));
  } else if (viewName === 'month' &&
    (!options.month.visibleWeeksCount || options.month.visibleWeeksCount > 4)) {
    html.push(moment(cal.getDate().getTime()).format('MMM YYYY'));
  } else {
    html.push(moment(cal.getDateRangeStart().getTime()).format('YYYY.MM.DD'));
    html.push(' ~ ');
    html.push(moment(cal.getDateRangeEnd().getTime()).format(' MM.DD'));
  }
  renderRange.innerHTML = html.join('');
}

function refreshScheduleVisibility() {
  var calendarElements = Array.prototype.slice.call(document.querySelectorAll('#calendarList input'));

  CalendarList.forEach(function(calendar) {
    cal.toggleSchedules(calendar.id, !calendar.checked, false);
  });

  cal.render(true);

  calendarElements.forEach(function(input) {
    var span = input.nextElementSibling;
    span.style.backgroundColor = input.checked ? span.style.borderColor : 'transparent';
  });
}
function downloadEvent(schedule) {
    var instance = schedule.raw.parentId != null
        ? RecurringSchedules[RecurringSchedules.findIndex(v => v.id === schedule.raw.parentId)]
        : schedule;
    let event = serialiseICal(instance, false);
    mainWindow.postMessage({event: event, title: schedule.title, type: 'downloadEvent'}, origin);
}
function emailEvent(schedule) {
    var instance = schedule.raw.parentId != null
        ? RecurringSchedules[RecurringSchedules.findIndex(v => v.id === schedule.raw.parentId)]
        : schedule;
    let event = serialiseICal(instance, false);
    let test = getCurrentTimeZoneId();
    let recurringText = schedule.raw.hasRecurrenceRule ? ' (Recurring: ' + schedule.recurrenceRule + ')' : '';
    let stateText = schedule.state == CALENDAR_EVENT_CANCELLED ? 'CANCELLED ' : '';
    let title = stateText + schedule.title + ' - ' + moment(schedule.start.toUTCString()).toLocaleString() + recurringText;
    mainWindow.postMessage({event: event, title: title, type: 'emailEvent'}, origin);
}
function shareCalendarEvent(schedule) {
   let dt = moment.utc(schedule.start.toUTCString());
   let year = dt.year();
   let month = dt.month() +1;
   let calendarName = findCalendar(schedule.calendarId).name;
   let scheduleId = schedule.raw.parentId != null ? schedule.raw.parentId : schedule.id;
   let isRecurring = schedule.raw.hasRecurrenceRule || schedule.raw.isException;
   mainWindow.postMessage({calendarName: calendarName, id: scheduleId, year: year, month: month, isRecurring: isRecurring, type: 'shareCalendarEvent'}, origin);
}
resizeThrottled = tui.util.throttle(function() {
  cal.render();
}, 50);

function setEventListener() {
  $('.dropdown-menu a[role="menuitem"]').on('click', onClickMenu);
  $('#menu-navi').on('click', onClickNavi);
  window.addEventListener('resize', resizeThrottled);
}
function updateRRULESummary() {
    if (rruleEditable) {
        let element = document.getElementById("rrule-summary");
        if (element != null) {
            element.innerText = generateRRuleText();
        } else {
            displayExceptionRRule(generateRRuleText());
        }
    }
}
//this is less than ideal
function displayExceptionRRule(text) {
    if (text.length == 0) {
        return;
    }
    let eventDetails = document.getElementById("event-details");
    var div1 = document.createElement("div");
    eventDetails.appendChild(div1);

    var span1 = document.createElement("span");
    div1.appendChild(span1);

    var img = document.createElement("img");
    img.classList.add("repeat-icon");
    img.classList.add("tui-full-calendar-ic-repeat-b");
    span1.appendChild(img);
    var span2 = document.createElement("span");
    span2.innerText = text;
    span1.appendChild(span2);
}
function buildExtraFieldsToSummary(eventData, that) {

    if (eventData == null) {
        rruleEditable = true;
        rrule = "";
    } else {
        rrule = eventData.schedule.recurrenceRule;
        if (eventData.schedule.raw.isException) {
            let parent = RecurringSchedules[RecurringSchedules.findIndex(v => v.id === eventData.schedule.raw.parentId)];
            rrule = parent.recurrenceRule;
        }
        if (parseRRULE()) {
            rruleEditable = true;
            updateRRULESummary();
        } else {
            rruleEditable = false;
            if (eventData.schedule.raw.isException) {
                displayExceptionRRule(rrule);
            }
        }
    }

    let calendarSpan = document.getElementById("calendar-name");
    var showDeleteBtn = false;
    if(eventData.schedule.raw.creator.name != currentUsername) {
        calendarSpan.innerText = calendarSpan.innerText + " (Shared by " + eventData.schedule.raw.creator.name + ")";
        let owner = getCalendarListItem(eventData.schedule.calendarId).owner;
        if (!loadCalendarAsGuest && owner == null) {
            showDeleteBtn = true;
        }
    }
    if (showDeleteBtn) {
        var deleteButton = document.createElement("button");
        calendarSpan.appendChild(deleteButton);
        deleteButton.appendChild(document.createTextNode("Delete"));
        deleteButton.style.marginLeft="20px";
        deleteButton.onclick=function() {
            that.hide();
            handleScheduleDeletion(eventData);
        };
    }
    let closeBtnDiv = document.getElementById("close-button");
    if(closeBtnDiv != null) {
        var closeBtn = document.createElement("button");
        closeBtn.classList.add("tui-full-calendar-button");
        closeBtn.classList.add("tui-full-calendar-popup-close");
        closeBtnDiv.appendChild(closeBtn);

        var btnSpan = document.createElement("span");
        btnSpan.classList.add("tui-full-calendar-icon");
        btnSpan.classList.add("tui-full-calendar-ic-close");
        closeBtn.appendChild(btnSpan);
        closeBtn.onclick=function() {
           that.hide();
            return true;
        };
    }

    let eventDetails = document.getElementById("event-details");
    var div1 = document.createElement("div");
    eventDetails.appendChild(div1);

    var span1 = document.createElement("span");
    div1.appendChild(span1);
    if(!eventData.schedule.isReadOnly) {
        var img = document.createElement("img");
        img.src = "./images/user-plus.svg";
        img.style.width="16px";
        img.style.height="16px";
        span1.appendChild(img);

        var shareLink = document.createElement("a");
        shareLink.style.cursor="pointer";
        shareLink.style.marginLeft="3px";
        shareLink.innerText = "Share";
        span1.appendChild(shareLink);
        shareLink.onclick=function() {
            shareCalendarEvent(eventData.schedule);
        };
        span1.appendChild(document.createTextNode('\u00A0\u00A0'));
    }

    var img5 = document.createElement("img");
    img5.src = "./images/download.png";
    span1.appendChild(img5);

    var downloadLink = document.createElement("a");
    downloadLink.style.cursor="pointer";
    downloadLink.style.marginLeft="3px";
    downloadLink.innerText = "Download";
    span1.appendChild(downloadLink);
    downloadLink.onclick=function() {
        downloadEvent(eventData.schedule);
    };

    span1.appendChild(document.createTextNode('\u00A0\u00A0'));
    var img6 = document.createElement("img");
    img6.src = "./images/envelope.png";
    span1.appendChild(img6);

    var emailLink = document.createElement("a");
    emailLink.style.cursor="pointer";
    emailLink.style.marginLeft="3px";
    emailLink.innerText = "Email";
    span1.appendChild(emailLink);
    emailLink.onclick=function() {
        emailEvent(eventData.schedule);
    };

    var div2 = document.createElement("div");
    eventDetails.appendChild(div2);
    var div3 = document.createElement("div");
    div3.classList.add("memo-field-alternate");
    div3.id = "popup-memo-readonly";
    div3.innerText = eventData == null ? "" : eventData.schedule.raw.memo;
    div2.appendChild(div3);
}
function addExtraFieldsToDetail(eventData) {

    previousRepeatCondition = "";
    if (eventData.schedule == null) {
        rrule = "";
    }
    let startDate = eventData.schedule == null ? moment(eventData.start.toDate()) : moment(eventData.schedule.start.toDate());
    createFrequencyDropdown(startDate);
    createDailyIntervalDropdown();
    createWeeklyIntervalDropdown();
    createMonthlyIntervalDropdown();
    createYearlyIntervalDropdown();
    byDayChoices();
    yearlyMonthChoice();
    freqMonthlyBy(startDate);
    monthlyByDayChoices();
    monthlyByDateChoices();
    repeatCondition(startDate);
    let readOnly = eventData.schedule != null && (eventData.schedule.raw.isException || !scheduleSameDay(eventData.schedule)) ? true : false;
    createRepeatDropdown(startDate, readOnly);

    if (rrule.length > 0) { //cannot use eventData.schedule != null && eventData.schedule.raw.isException
        let calendarDropdown = document.getElementById("calendar-dropdown");
        calendarDropdown.style.pointerEvents = 'none';
    }
    let lock = document.getElementById("tui-full-calendar-schedule-private");
    lock.style.display = 'none';

    let loc = document.getElementById("tui-full-calendar-schedule-location");
    let parent = loc.parentNode.parentNode.parentNode;
    var locTextArea = document.createElement("textarea");
    locTextArea.id = "popup-memo";
    locTextArea.value = eventData.schedule == null ? "" : eventData.schedule.raw.memo;
    locTextArea.rows = 5;
    locTextArea.classList.add("memo-field-edit");

    var div1 = document.createElement("div");
    parent.appendChild(div1);
    var div2 = document.createElement("div");
    div1.appendChild(div2);
    div2.appendChild(locTextArea);
    if (eventData.schedule != null) {
        let saveBtn = document.getElementById("popup-save");
        var handler = function() {
            eventData.schedule.raw.memo = locTextArea.value;
            //more rrule validation
            let frequency = extractPart("FREQ",function(val){ return val;});
            if (frequency == 'WEEKLY' && ! hasPart("BYDAY")) {
                rrule = '';
            } else if (frequency == 'MONTHLY' && ! hasPart("BYDAY") && ! hasPart("BYMONTHDAY")) {
                rrule = '';
            }
        }
        saveBtn.onclick=handler;
    }
}

function showMessagePopup(msg) {
    var calendarMessageModal = document.getElementById("calendarMessageModal");
    calendarMessageModal.style.display = "block";
    let configurationPopupCloseFunc = function() {
         calendarMessageModal.style.display = "none";
    };
    var calendarModalClose = document.getElementsByClassName("calendar-message-modal-close")[0];
    calendarModalClose.onclick = configurationPopupCloseFunc;
    var okButton = document.getElementById("calendar-ok-button");
    okButton.onclick = configurationPopupCloseFunc;

    var text = document.getElementById("calendar-message-text");
    text.innerText = msg;
}

function showConfigurationPopup() {
    var calendarModal = document.getElementById("calendarModal");
    calendarModal.style.display = "block";
    destroyColorPicker();

    let colorChange = {targetId: null, newColor: null, oldColor: null};
    let configurationPopupCloseFunc = function() {
         calendarModal.style.display = "none";
    };
    calendarModal.onclick = (ev) => calendarModalHandler(ev, colorChange, configurationPopupCloseFunc);

    var calendarModalClose = document.getElementsByClassName("calendar-modal-close")[0];
    calendarModalClose.onclick = configurationPopupCloseFunc;

	let calendarListElement = document.getElementById('calendar-list');
	while(calendarListElement.hasChildNodes()) {
        calendarListElement.removeChild(calendarListElement.firstChild);
	}
    CalendarList.forEach(function(calendar) {
        appendCalendar(calendar);
    });
}

function calendarModalHandler(event, colorChange, configurationPopupCloseFunc) {
    let colorChangeCallback = function(targetId, newColor, oldColor) {
        colorChange.targetId = targetId;
        colorChange.newColor = newColor;
        colorChange.oldColor = oldColor;
    }
    if (event.target.id == "calendarModal") {
        configurationPopupCloseFunc();
    } else if (event.target.id == "color-picker-container" || event.target.id == "color-picker-cancel-btn") {
        resetColorChange(colorChange);
    } else if (event.target.id == "color-picker-confirm-btn") {
        calendarColorChange(colorChange);
    } else if (event.srcElement.className == "line-item") {
        calendarColorChooser(event.target.id, colorChangeCallback);
    }
}
function resetColorChange(colorChange) {
    if (colorChange.targetId != null) {
        let calendarItem = document.getElementById(colorChange.targetId);
        let originalColor = colorChange.oldColor;
        calendarItem.style = "border-color:" + originalColor + "; background-color: " + originalColor;
    }
    destroyColorPicker();
}
function calendarColorChange(colorChange) {
    if (colorChange.targetId == null) {
        return;
    }
    let id = colorChange.targetId.substring(colorChange.targetId.lastIndexOf('-') + 1);
    let calendarName = findCalendar(id).name;
    let newColor = colorChange.newColor;
    let oldColor = colorChange.oldColor;
    if (newColor != oldColor) {
        mainWindow.postMessage({action:'requestCalendarColorChange', calendarName: calendarName, newColor: newColor}, origin);
        colorChange.targetId = colorChange.newColor = colorChange.oldColor = null;
    }
    colorPickerElement.classList.add("calendar-hidden");
}
function appendCalendar(item) {

    let calendarListElement = document.getElementById('calendar-list');
    var li = document.createElement("li");
    li.id = "cal-id-" + item.id;
    calendarListElement.appendChild(li);

    var div = document.createElement("DIV");
    li.appendChild(div);

    var inputItem = document.createElement("INPUT");
    div.appendChild(inputItem);
    inputItem.type = "checkbox";
    inputItem.className = "tui-full-calendar-checkbox-round";
    inputItem.value = "";
    inputItem.checked = true;

    var itemSpan = document.createElement("SPAN");
    div.appendChild(itemSpan);
    itemSpan.style = "border-color: " + item.borderColor + "; background-color: " + item.borderColor;
    itemSpan.id = "cal-item-" + item.id;
    itemSpan.className = "line-item";

    var innerDiv = document.createElement("DIV");
    innerDiv.id = "cal-item-name-" + item.id;
    innerDiv.style = "display: contents;";
    div.appendChild(innerDiv);
    var itemName = document.createTextNode(item.name);
    innerDiv.appendChild(itemName);
    innerDiv.style.cursor = "text";
	innerDiv.addEventListener('click', function(){renameCalendar(item);});
    var span = document.createElement("SPAN");
    span.className = "line-items-calendar-buttons";
    li.appendChild(span);

    if (item.id != CALENDAR_ID_MY_CALENDAR && item.owner == null && item.shareable) {
           var shareButton = document.createElement("button");
           shareButton.innerText = 'Share';
           shareButton.style = "margin-right: 5px;";
           shareButton.addEventListener('click', function(){shareCalendar(item);});
           span.appendChild(shareButton);
    }
    if (item.owner == null) {
        var importICalButton = document.createElement("button");
        importICalButton.innerText = 'Import';
        importICalButton.addEventListener('click', function(){
            document.getElementById('uploadICalInput-cal-' + item.id).click();
        });
        span.appendChild(importICalButton);

        var uploadICal = document.createElement("INPUT");
        uploadICal.type = "file";
        uploadICal.id = 'uploadICalInput-cal-' + item.id;
        uploadICal.addEventListener('change', function(evt){
            importICal(item, evt);
        });
        uploadICal.style="display:none;";
        uploadICal.accept="text/calendar";
        span.appendChild(uploadICal);
    }
    var deleteCalendarButton = document.createElement("img");
    //deleteCalendarButton.innerText = 'Delete';
    deleteCalendarButton.src = "./images/trash.png";
    deleteCalendarButton.style.marginLeft = "10px";
    if (item.id == CALENDAR_ID_MY_CALENDAR) {
        deleteCalendarButton.style.visibility= 'hidden';
    } else {
    	deleteCalendarButton.addEventListener('click', function(){
    	    deleteCalendar(item);
        });
    }
    span.appendChild(deleteCalendarButton);
}

function importICal(item, evt){
    let files = evt.target.files || evt.dataTransfer.files;
    let file = files[0];
    let filereader = new FileReader();
    filereader.onload = function(){
        importICSFile(this.result, currentUsername, false, false, item.name, false);
    };
    filereader.readAsText(file);
}
function deleteCalendar(item){
    console.log("deleteCalendar=" + item.name);
    mainWindow.postMessage({ calendarName: item.name, id: item.id, type:"deleteCalendar"}, origin);
}
function calendarColorChooser(id, changeCallback){
    let calendarItem = document.getElementById(id);

    let currentColor = calendarItem.style.borderColor;
    destroyColorPicker();
    let currentColorRGB = toHexString(currentColor);
    colorPalette[0] = currentColorRGB;

    colorPickerElement.classList.remove("calendar-hidden");
    colorpicker = tui.colorPicker.create({
        container: colorPickerElement,
        usageStatistics: false,
        preset: colorPalette,
        color: colorPalette[0],
        detailTxt: 'Confirm'
    });
    colorpicker._onToggleSlider();
    colorpicker.on('selectColor', function(ev) {
        let updatedColor = ev.color;
        calendarItem.style = "border-color:" + updatedColor + "; background-color: " + updatedColor;
        changeCallback(id, updatedColor, currentColorRGB);
    });
    //let colorPickerEl = document.getElementById('color-picker');
    var colorPickerContainer = document.getElementsByClassName("tui-colorpicker-container")[0];
//, '<input id="color-picker-confirm-btn" type="button" class="{{cssPrefix}}palette-toggle-slider" value="{{detailTxt}}" />'
    var buttonDiv = document.createElement("div");
    buttonDiv.classList.add("tui-colorpicker-button-container");
    colorPickerContainer.appendChild(buttonDiv);

    var cancelItem = document.createElement("INPUT");
    buttonDiv.appendChild(cancelItem);
    cancelItem.id="color-picker-cancel-btn";
    cancelItem.type = "button";
    cancelItem.classList.add("button-cancel");
    cancelItem.value = "Cancel";
    
    var confirmItem = document.createElement("INPUT");
    buttonDiv.appendChild(confirmItem);
    confirmItem.id="color-picker-confirm-btn";
    confirmItem.type = "button";
    confirmItem.classList.add("button-confirm");
    confirmItem.value = "OK";
}
function destroyColorPicker() {
    if(colorpicker != null) {
        colorpicker.destroy();
        colorpicker = null;
        colorPickerElement.classList.add("calendar-hidden");
    };
}
function toHexString(rdgColourStr) {
    let colorRGB = rdgColourStr.substring(4);
    colorRGB = colorRGB.substring(0, colorRGB.length - 1);
    colorRGB = colorRGB.split(',');
    let red = toHex(new Number(colorRGB[0]));
    let green = toHex(new Number(colorRGB[1]));
    let blue = toHex(new Number(colorRGB[2]));
    return "#" +  red + green + blue;
}

function toHex(n) {
  var hex = n.toString(16);
  while (hex.length < 2) {hex = "0" + hex; }
  return hex;
}

/**
 * Toggle calendar list, when user clicks calendars button
 */
function toggleCalendarsView(event) {
    var cals = document.getElementById("lnb")
    let visible = !cals.classList.contains("calendar-hidden");
    if (visible) {
        cals.classList.add("calendar-hidden");
        document.getElementById("right").style.left = "0px"
    } else {
        cals.classList.remove("calendar-hidden");
        document.getElementById("right").style.left = "200px"
    }
    event.stopPropagation();
};

//--RRULE
function changeRepeatOption(startDate) {
    let selectedValue = document.getElementById('repeat-dropdown').value;
    var isCustom = false;
    if (selectedValue == "no-repeat") {
        rrule = "";
        document.getElementById("rrule-modal").style.display = "none";
        return;
    } else if (selectedValue == "DAILY") {
        rrule = "FREQ=DAILY;INTERVAL=1";
    } else if (selectedValue == "WEEKDAY") {
        rrule = "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR";
    } else if (selectedValue == "WEEKLY") {
        let dayOfWeek = startDate.day();
        rrule = "FREQ=WEEKLY;INTERVAL=1;BYDAY=" + byDayLabelParts[dayOfWeek];
    } else if (selectedValue == "YEARLY") {
        let dayOfMonth = startDate.date();
        let month = startDate.month() + 1;
        rrule = "FREQ=YEARLY;INTERVAL=1;BYMONTH=" + month + ";BYMONTHDAY=" + dayOfMonth;
    } else if (selectedValue == "CUSTOM") {
        console.log("custom");
        if (!rruleEditable) {
            displayMessage("Editing this Event's current repeating rule not supported.");
            return;
        }
        isCustom = true;
    }
    if (isCustom) {
        document.getElementById("rrule-modal").style.display = "block";
    } else {
        document.getElementById("rrule-modal").style.display = "none";
    }
    processRRULE(startDate);
}
function repeatCondition(startDate) {
    var parent = document.getElementById("rrule-modal");
    var div = document.createElement("div");
    div.id='repeat-condition';
    parent.appendChild(div);

    let onChange = function() {
        applyRRULE();
    }
    let clazz = "label-spacing";
    let element = addInput(div, 'radio', 'repeat-condition-forever', 'repeat-condition', 'forever', 'Forever', onChange, clazz);
    element.checked = true;
    addInput(div, 'radio', 'repeat-condition-until', 'repeat-condition', 'until', 'Until', onChange, clazz);
    addInput(div, 'radio', 'repeat-condition-occurrences', 'repeat-condition', 'occurrences', 'Occurrence(s)', onChange, clazz);

    var div = document.createElement("div");
    div.id='repeat-occurrences-counter';
    div.style.display = "none";
    parent.appendChild(div);

    var span1 = document.createElement("span");
    div.appendChild(span1);

    var number = document.createElement("input");
    number.type= 'number';
    number.id= 'repeat-counter';
    number.min = '1';
    number.max = '99999';
    number.value = '1';
    number.addEventListener('change', onChange);
    span1.appendChild(number);

    var div = document.createElement("div");
    div.id='repeat-until';
    div.style.display = "none";
    parent.appendChild(div);

    var span2 = document.createElement("span");
    div.appendChild(span2);

    var date = document.createElement("input");
    date.type= 'date';
    date.id= 'until-date';

    let formattedStartDate = formatDateString(untilUTCTimeString(moment(startDate)));
    date.min = formattedStartDate;
    date.max = '3000-01-01';
    date.maxlength = '12';
    date.value = '';
    date.addEventListener('change', onChange);
    span2.appendChild(date);
}
function generateSuffix(num) {
    return num == 11 || num == 12 || num == 13 ? "th" : suffix[num % 10];
}
function monthlyByDateChoices() {
    var parent = document.getElementById("rrule-container-2");
    var div = document.createElement("div");
    div.id='monthly-by-date-choices';
    div.className = 'rrule-container-block';
    div.style.display = "none";
    parent.appendChild(div);

    var dropdown = document.createElement("select");
    dropdown.id='monthly-date';
    dropdown.className = 'custom-dropdown';
    dropdown.addEventListener('change', function(){applyRRULE();});
    for(var i = 1; i < 32; i++) {
        let ending = generateSuffix(i);
        addOptionToSelect(dropdown, 'monthly-date-' + i, i, i + ending + " day");
    }
    div.appendChild(dropdown);
}
function monthlyByDayChoices() {
    var parent = document.getElementById("rrule-container-2");
    var div = document.createElement("div");
    div.id='monthly-by-day-choices';
    div.className = 'rrule-container-block';
    div.style.display = "none";
    parent.appendChild(div);

    var dropdown = document.createElement("select");
    dropdown.id='monthly-day';
    dropdown.className = 'custom-dropdown';
    dropdown.addEventListener('change', function(){applyRRULE();});
    var j = -1;
    var k = 0;
    for(var i = 0 ; i < byMonthDayLabelParts.length; i++) {
        if (i % 7 == 0) {
            j++;
            k = 0;
        }
        let innerText = weeks[j] + ' ' + byDayLongLabelParts[k];
        addOptionToSelect(dropdown, 'monthly-day-' + byMonthDayLabelParts[i], byMonthDayLabelParts[i], innerText);
        k++;
    }
    div.appendChild(dropdown);
}
//todo make this efficient
function getMonthlyByDayNameFromIndex(monthDay) {
    var j = -1;
    var k = 0;
    for(var i = 0 ; i < byMonthDayLabelParts.length; i++) {
        if (i % 7 == 0) {
            j++;
            k = 0;
        }
        if(monthDay == byMonthDayLabelParts[i]) {
            return weeksLowercase[j] + ' ' + byDayMediumLabelParts[k];
        }
        k++;
    }
}
function freqMonthlyBy(startDate) {
    var parent = document.getElementById("rrule-container-2");
    var div = document.createElement("div");
    div.id='freq-monthly-by';
    div.className = 'rrule-container-block';
    div.style.display = "none";
    parent.appendChild(div);

    var dropdown = document.createElement("select");
    dropdown.id='frequency-dropdown-monthly';
    dropdown.className = 'custom-dropdown';
    dropdown.addEventListener('change', function(){changeMonthlyBy(startDate);});
    addOptionToSelect(dropdown, 'freq-by-date', "BYMONTHDAY", "by Date");
    addOptionToSelect(dropdown, 'freq-by-day', "BYDAY", "by Day");
    div.appendChild(dropdown);
}
function yearlyMonthChoice() {
    var parent = document.getElementById("rrule-container-2");
    var div = document.createElement("div");
    div.id='yearly-month-choice';
    div.className = 'rrule-container-block';
    div.style.display = "none";
    parent.appendChild(div);

    var dropdown = document.createElement("select");
    dropdown.id='yearly-month';
    dropdown.className = 'custom-dropdown';
    dropdown.addEventListener('change', function(){applyRRULE();});
    for(var i = 1; i < 13; i++) {
        addOptionToSelect(dropdown, 'yearly-month-' + i, i, monthLongLabelParts[i-1]);
    }
    div.appendChild(dropdown);
}
function createYearlyIntervalDropdown() {
    var parent = document.getElementById("rrule-container-1");
    var div = document.createElement("div");
    div.id='yearly-interval';
    div.className = 'rrule-container-block';
    div.style.display = "none";
    parent.appendChild(div);

    var dropdown = document.createElement("select");
    dropdown.id='yearly-frequency';
    dropdown.className = 'custom-dropdown';
    dropdown.addEventListener('change', function(){applyRRULE();});
    addOptionToSelect(dropdown, 'yearly-frequency-1', '1', "Every year");
    addOptionToSelect(dropdown, 'yearly-frequency-2', '2', "Every other year");
    for(var i = 3; i < 11; i++) {
        let ending = generateSuffix(i);
        addOptionToSelect(dropdown, 'yearly-frequency-' + i, i, "Every " + i + ending + " year");
    }
    div.appendChild(dropdown);
}
function createMonthlyIntervalDropdown() {
    var parent = document.getElementById("rrule-container-1");
    var div = document.createElement("div");
    div.id='monthly-interval';
    div.className = 'rrule-container-block';
    div.style.display = "none";
    parent.appendChild(div);

    var dropdown = document.createElement("select");
    dropdown.id='monthly-frequency';
    dropdown.className = 'custom-dropdown';
    dropdown.addEventListener('change', function(){applyRRULE();});
    addOptionToSelect(dropdown, 'monthly-frequency-1', '1', "Every month");
    addOptionToSelect(dropdown, 'monthly-frequency-2', '2', "Every other month");
    for(var i = 3; i < 13; i++) {
        let ending = generateSuffix(i);
        addOptionToSelect(dropdown, 'monthly-frequency-' + i, i, "Every " + i + ending + " month");
    }
    div.appendChild(dropdown);
}
function byDayChoices() {
    var parent = document.getElementById("rrule-container-2");
    var div = document.createElement("div");
    div.id = "by-day-choices";
    div.className = 'rrule-container-block';
    div.style.display = "none";
    parent.appendChild(div);
    let onChange = function() {
        applyRRULE();
    }
    let clazz = "label-spacing";
    for(var i = 0; i < 7 ; i++) {
        addInput(div, 'checkbox', 'by-day-' + byDayLabelParts[i], byDayLongLabelParts[i], byDayMediumLabelParts[i], byDayMediumLabelParts[i] , onChange, clazz);
    }
}
function createWeeklyIntervalDropdown() {
    var parent = document.getElementById("rrule-container-1");
    var div = document.createElement("div");
    div.id='weekly-interval';
    div.className = 'rrule-container-block';
    div.style.display = "none";
    parent.appendChild(div);

    var dropdown = document.createElement("select");
    dropdown.id='weekly-frequency';
    dropdown.className = 'custom-dropdown';
    dropdown.addEventListener('change', function(){applyRRULE();});
    let option = addOptionToSelect(dropdown, 'weekly-frequency-1', '1', "Every week");
    option.checked = true;
    addOptionToSelect(dropdown, 'weekly-frequency-2', '2', "Every other week");
    for(var i = 3; i < 27; i++) {
        let ending = generateSuffix(i);
        addOptionToSelect(dropdown, 'weekly-frequency-' + i, i, "Every " + i + ending + " week");
    }
    div.appendChild(dropdown);
}
function addInput(parentElement, type, id, name, value, text, onChangeHandler, clazz) {
    var input = document.createElement("input");
    input.type= type;
    input.id= id;
    input.name = name;
    input.value = value;
    input.addEventListener('change', onChangeHandler);
    parentElement.appendChild(input);
    var label = document.createElement("label");
    label.innerText = text;
    if (clazz != null) {
        label.className = clazz;
    }
    parentElement.appendChild(label);
    return input;
}
function createDailyIntervalDropdown() {
    var parent = document.getElementById("rrule-container-1");
    var div = document.createElement("div");
    div.id='daily-interval';
    div.className = 'rrule-container-block';
    div.style.display = "none";
    parent.appendChild(div);

    var dropdown = document.createElement("select");
    dropdown.id='daily-frequency';
    dropdown.className = 'custom-dropdown';
    dropdown.addEventListener('change', function(){applyRRULE();});
    let select = addOptionToSelect(dropdown, 'daily-frequency-1', '1', "Every day");
    select.checked = true;
    addOptionToSelect(dropdown, 'daily-frequency-2', '2', "Every other day");
    for(var i = 3; i < 31; i++) {
        let ending = generateSuffix(i);
        addOptionToSelect(dropdown, 'daily-frequency-' + i, i, "Every " + i + ending + " day");
    }
    div.appendChild(dropdown);
}
function createFrequencyDropdown(startDate) {
    var parent = document.getElementById("rrule-container-1");
    var div = document.createElement("div");
    div.className = 'rrule-container-block';
    parent.appendChild(div);

    var dropdown = document.createElement("select");
    dropdown.id='frequency-dropdown';
    dropdown.className = 'custom-dropdown';
    dropdown.addEventListener('change', function(){changeFrequency(startDate);});

    addOptionToSelect(dropdown, 'freq-daily', 'DAILY', "Daily");
    addOptionToSelect(dropdown, 'freq-weekly', 'WEEKLY', "Weekly");
    addOptionToSelect(dropdown, 'freq-monthly', 'MONTHLY', "Monthly");
    addOptionToSelect(dropdown, 'freq-yearly', 'YEARLY', "Yearly");

    div.appendChild(dropdown);
}

function addOptionToSelect(selectElement, id, value, innerText) {
    var option = document.createElement("option");
    option.id = id;
    option.value = value;
    option.innerText = innerText;
    selectElement.appendChild(option);
    return option;
}

function createRepeatDropdown(startDate, isReadOnly) {

    let dayOfWeek = startDate.day();
    let dayOfMonth = startDate.date();
    let month = startDate.month();
    let ending = generateSuffix(dayOfMonth);
    let asStr = dayOfMonth + ending;

    var parent = document.getElementById("repeat-div");

    var existingDropdown = document.getElementById("repeat-dropdown");
    if (existingDropdown != null) {
        parent.removeChild(existingDropdown);
    }

    var dropdown = document.createElement("select");
    dropdown.id='repeat-dropdown';
    dropdown.name='repeat-dropdown';
    dropdown.className = 'custom-dropdown';
    dropdown.addEventListener('change', function(){changeRepeatOption(startDate);});

    if (rrule != null && rrule.length > 0) {
        var custom = document.createElement("option");
        custom.id='repeat-rrule';
        custom.value=rrule;
        custom.innerText = rruleEditable ? generateRRuleText() : rrule;
        dropdown.appendChild(custom);
    }

    var noRepeat = document.createElement("option");
    noRepeat.id='no-repeat';
    noRepeat.value='no-repeat';
    noRepeat.innerText = "Does not repeat";
    dropdown.appendChild(noRepeat);

    var daily = document.createElement("option");
    daily.id='repeat-daily';
    daily.value='DAILY';
    daily.innerText = "Daily";
    dropdown.appendChild(daily);

    var weekday = document.createElement("option");
    weekday.id='repeat-weekday';
    weekday.value='WEEKDAY';
    weekday.innerText = "Every weekday (Monday to Friday)";
    dropdown.appendChild(weekday);

    var weekly = document.createElement("option");
    weekly.id='repeat-weekly';
    weekly.value='WEEKLY';
    weekly.innerText = "Weekly on " + byDayLongLabelParts[dayOfWeek]
    dropdown.appendChild(weekly);

    var yearly = document.createElement("option");
    yearly.id='repeat-yearly';
    yearly.value='YEARLY';
    yearly.innerText = "Annually on " + asStr + " of " + monthLongLabelParts[month];
    dropdown.appendChild(yearly);

    var custom = document.createElement("option");
    custom.id='repeat-custom';
    custom.value='CUSTOM';
    custom.innerText = "Custom...";
    dropdown.appendChild(custom);
    if (isReadOnly) {
        dropdown.disabled = true;
    }
    parent.appendChild(dropdown);
}
function resetRRULEUI() {
    document.getElementById('freq-daily').selected = true;
    document.getElementById('freq-monthly-by').style.display = 'none';
    document.getElementById('daily-interval').style.display = 'none';
    document.getElementById('repeat-occurrences-counter').style.display = 'none';
    document.getElementById('repeat-until').style.display = 'none';

    document.getElementById('weekly-interval').style.display = 'none';
    document.getElementById('by-day-choices').style.display = 'none';

    document.getElementById('monthly-interval').style.display = 'none';
    document.getElementById('monthly-by-day-choices').style.display = 'none';
    document.getElementById('monthly-by-date-choices').style.display = 'none';

    document.getElementById('yearly-interval').style.display = 'none';
    document.getElementById('yearly-month-choice').style.display = 'none';

    document.getElementById('daily-frequency').value = '';
    document.getElementById('weekly-frequency').value = '';
    for(var i = 0 ; i < byDayLabelParts.length; i++) {
        document.getElementById('by-day-' + byDayLabelParts[i]).checked = false;
    }
    document.getElementById('monthly-frequency').value = '';
    document.getElementById('yearly-frequency').value = '';
    document.getElementById('yearly-month').value = '';
    document.getElementById('monthly-day').value = "";
    document.getElementById('monthly-date').value = "";
}
function changeFrequency(startDate) {
    let freq = document.getElementById('frequency-dropdown').value;
    //console.log("frequency-dropdown=" + freq);
    rrule = "FREQ=" + freq + ";" + removePart("FREQ", rrule);
    processRRULE(startDate);
}
function changeMonthlyBy(startDate) {
    let freq = document.getElementById('frequency-dropdown').value;
    let by = document.getElementById('frequency-dropdown-monthly').value;
    //console.log("frequency-dropdown-monthly=" + by);

    let val = "";
    var updatedRRule = rrule;
    if (by == "BYDAY") {
        val = "1MO";
        updatedRRule = removePart("BYMONTHDAY", rrule);
    } else if(by == "BYMONTHDAY") {
        val = startDate.date();
        updatedRRule = removePart("BYDAY", rrule);
    }
    rrule = updatedRRule + by + "=" + val;
    processRRULE(startDate);
}
function removePart(paramName, recurringRule) {
    let remainingPartsBuffer = "";
    let parts = recurringRule.split(';');
    for(var i = 0; i < parts.length; i++) {
        let part = parts[i];
        if (part != null && part.length > 0) {
            let paramKV = part.split('=');
            if(paramName != paramKV[0].toUpperCase()){
                remainingPartsBuffer = remainingPartsBuffer + part + " ";
            }
        }
    }
    return remainingPartsBuffer.split(" ").join(";");
}

function setHandler(initFunc, handlerFunc) {
    initFunc();
    rrule_handler = handlerFunc;
    applyRRULE();
}
function applyRRULE() {
    let result = rrule_handler();
    //console.log("output=" + result);
    rrule = result;
}
function showImportError(err) {
    displayMessage("Unable to import Event due to error: " + err);
    console.log("import error=" + err);
}
function showRecurrenceError(err) {
    displayMessage("Event recurrence error: " + err);
    console.log("recurrence error=" + err);
}
function extractPart(paramName, validator) {
    return extractPartFromRecurrenceRule(rrule, paramName, validator);
}
function extractPartFromRecurrenceRule(recurrenceRule, paramName, validator) {
    let parts = recurrenceRule.split(';');
    for(var i = 0; i < parts.length; i++) {
        let part = parts[i];
        if (part != null && part.length > 0) {
            let paramKV = part.split('=');
            if(paramName == paramKV[0].toUpperCase()){
                return validator(paramKV[1].trim());
            }
        }
    }
    return validator("");
}
function hasPart(paramName) {
    return hasPartFromRecurrenceRule(rrule, paramName);
}
function hasPartFromRecurrenceRule(recurrenceRule, paramName) {
    let parts = recurrenceRule.split(';');
    for(var i = 0; i < parts.length; i++) {
        let part = parts[i];
        if (part != null && part.length > 0) {
            let paramKV = part.split('=');
            if(paramName == paramKV[0].toUpperCase()){
                return true;
            }
        }
    }
    return false;
}
function getIntervalText(number, unit) {
    if (number == '1') {
        return 'Every ' + unit;
    } else if (number == '2') {
        return 'Every other ' + unit;
    } else {
        let ending = generateSuffix(number);
        return "Every " + number + ending + ' ' + unit;
    }
}
function generateRRuleText() {
    let buffer = "";
    let frequency = extractPart("FREQ", function(val){return val;});
    let interval = extractPart("INTERVAL", function(val){return val;});
    if (interval == 1 || interval == "") {
        if(frequency == "DAILY") {
            buffer = "Daily";
        } else if(frequency == "WEEKLY") {
            buffer = "Weekly";
        } else if(frequency == "MONTHLY") {
            buffer = "Monthly";
        } else if(frequency == "YEARLY") {
            buffer = "Yearly";
        }
    } else {
        if(frequency == "DAILY") {
            buffer = getIntervalText(interval, 'day');
        } else if(frequency == "WEEKLY") {
            buffer = getIntervalText(interval, 'week');
        } else if(frequency == "MONTHLY") {
            buffer = getIntervalText(interval, 'month');
        } else if(frequency == "YEARLY") {
            buffer = getIntervalText(interval, 'year');
        }
    }

    let byDay = extractPart("BYDAY", function(val){return val;});
    if (byDay.length > 0) {
        let values = byDay.trim().split(",");
        if(frequency == "WEEKLY") {
            var days = "";
            var weekdays = true;
            for(var j = 1 ; j <= 5; j++) {
                var foundDay = false;
                for(var i = 0 ; i < values.length; i++) {
                    if(values[i] == byDayLabelParts[j]) {
                        foundDay = true;
                        break;
                    }
                }
                if (!foundDay) {
                    weekdays = false;
                    break;
                }
            }
            for(var j = 0 ; j <= 6; j+=6) {
                var foundDay = false;
                for(var i = 0 ; i < values.length; i++) {
                    if(values[i] == byDayLabelParts[j]) {
                        foundDay = true;
                        break;
                    }
                }
                if (foundDay) {
                    weekdays = false;
                    break;
                }
            }
            if (weekdays) {
                buffer = buffer + " (Monday to Friday)";
            } else {
                for(var i = 0 ; i < values.length; i++) {
                    let index = byDayLabelParts.findIndex(v => v === values[i])
                    days = days + byDayMediumLabelParts[index] + " ";
                }
                buffer = buffer + " on " + days.trim().split(" ").join(", ");
            }
        } else if(frequency == "MONTHLY" || frequency == "YEARLY") {
            var monthlyDays = "";
            for(var i = 0 ; i < values.length; i++) {
                monthlyDays = monthlyDays + getMonthlyByDayNameFromIndex(values[i]) + "|";
            }
            buffer = buffer + " on the " + monthlyDays.trim().split("|").join(", ").trim();
            buffer = buffer.substring(0, buffer.length -1);
        }
    }
    byMonth = extractPart("BYMONTH", function(val){return val.trim().split(",")[0];});
    if (byMonth.length > 0) {
        let values = byMonth.trim().split(",");
        buffer = buffer + " in " + monthShortLabelParts[byMonth-1] ;
    }
    byMonthDay = extractPart("BYMONTHDAY", function(val){return val;});
    if (byMonthDay.length > 0) {
        let values = byMonthDay.trim().split(",");
        if(frequency == "MONTHLY") {
            buffer = buffer + " on the " + values[0] + generateSuffix(values[0]);
        }else if(frequency == "YEARLY") {
            buffer = "Annually on " + monthShortLabelParts[byMonth-1] + " " + values[0] + generateSuffix(values[0]);
        }
    }
    let until = extractPart("UNTIL", function(val){return val;});
    if (until.length > 0) {
        buffer = buffer + " until " + formatUntil();
    }
    let occurrences = extractPart("COUNT", function(val){return val;});
    if (occurrences.length > 0 && occurrences != "1") {
        buffer = buffer + " repeated for " + occurrences + " occurrences";
    }

    return buffer;
}
function formatUntil() {
    let rule = ICAL.Recur.fromString(rrule);
    let jsDateString = rule.until.toJSDate().toISOString().split("-").join("");
    return formatDateString(jsDateString);
}
function formatDateString(yyyymmdd) {
    return yyyymmdd.substring(0,4) + '-' + yyyymmdd.substring(4,6) + '-' + yyyymmdd.substring(6,8);
}
function parseRRULE() {
    if (rrule == null || rrule.length == 0) {
        return true;
    }
    let frequency = extractPart("FREQ",
        function(val){
            return frequencyValidator(val) ? val : null;
        }
    );
    if (frequency == null) {
        showRecurrenceError("Frequency specified not supported");
        return false;
    }
    let weekStartOK = extractPart("WKST",
        function(val){
            if (val.length == 0) {
                return true;
            }
            let values = val.trim().split(",");
            if (values.length > 1) {
                return false;
            }
            return confirmValues(values, byDayLabelParts);
        }
    );
    if (!weekStartOK) {
        showRecurrenceError("Week Start specified not supported");
        return false;
    }
    let intervalOK = extractPart("INTERVAL",
        function(val){
            if (val == "") {
                return true;
            }
            if (frequency == "DAILY") {
                return numericValidator(val, 1, 30);
            } else if(frequency == "WEEKLY") {
                return numericValidator(val, 1, 26)
            } else if(frequency == "MONTHLY") {
                return monthStepsValidator(val);
            } else if(frequency == "YEARLY") {
                return numericValidator(val, 1, 10);
            }
        }
    );
    if (!intervalOK) {
        showRecurrenceError("Interval specified not supported");
        return false;
    }
    var untilProvided = false;
    let untilOK = extractPart("UNTIL",
        function(val){
            if (val.length == 0) {
                return true;
            } else {
                untilProvided = true;
                return untilDateValidator();
            }
        }
    );
    if (!intervalOK) {
        showRecurrenceError("Until specified not supported");
        return false;
    }
    var countProvided = false;
    let countOK = extractPart("COUNT",
        function(val){
            if (val.length == 0) {
                return true;
            } else {
                countProvided = true;
                return numericValidator(val, 1, 999);
            }
        }
    );
    if (!countOK) {
        showRecurrenceError("Count specified not supported");
        return false;
    }
    if (untilProvided && countProvided) {
        showRecurrenceError("Combined Until and Count not supported");
        return false;
    }
    var byDaySet = false;
    let byDayOK = extractPart("BYDAY",
        function(val){
            if (val.length == 0) {
                return true;
            }
            let values = val.trim().split(",");
            byDaySet = true;
            var parts = [];
            if(frequency == "DAILY") {
                return false;
            } else if(frequency == "WEEKLY") {
                parts = byDayLabelParts;
            } else if(frequency == "MONTHLY" || frequency == "YEARLY") {
                if (values.length > 1) {
                    return false;
                }
                parts = byMonthDayLabelParts;
            }
            return confirmValues(values, parts);
        }
    );
    if (!byDayOK) {
        showRecurrenceError("ByDay specified not supported");
        return;
    }
    var byMonthDaySet = false;
    let byMonthDayOK = extractPart("BYMONTHDAY",
        function(val){
            if (val.length == 0) {
                return true;
            }
            let values = val.trim().split(",");
            byMonthDaySet = true;
            var parts = [];
            if(frequency == "DAILY" || frequency == "WEEKLY") {
                return false;
            } else if(frequency == "MONTHLY" || frequency == "YEARLY") {
                if (values.length > 1) {
                    return false;
                }
                parts = byDateLabelParts;
            }
            return confirmValues(values, parts);
        }
    );
    if (!byMonthDayOK) {
        showRecurrenceError("ByMonthDay specified not supported");
        return false;
    }
    var byMonthSet = false;
    let byMonthOK = extractPart("BYMONTH",
        function(val){
            if (val.length == 0) {
                return true;
            }
            let values = val.trim().split(",");
            byMonthSet = true;
            var parts = [];
            if(frequency == "DAILY" || frequency == "WEEKLY" || frequency == "MONTHLY") {
                return false;
            } else if(frequency == "YEARLY") {
                if (values.length > 1) {
                    return false;
                }
                parts = monthLabelParts;
            }
            return confirmValues(values, parts);
        }
    );
    if (!byMonthOK) {
        showRecurrenceError("ByMonth specified not supported");
        return false;
    }
    if (frequency == "YEARLY") {
        if (!( (byDaySet || byMonthDaySet) && byMonthSet)) {
            showRecurrenceError("Specified Yearly repeating rule not supported");
            return false;
        }
    }
    if (byDaySet && byMonthDaySet) {
        showRecurrenceError("Combined BYDAY and BYMONTH rules not supported");
        return false;
    }
    return true;
}
function confirmValues(values, parts) {
    for(var j = 0; j < values.length; j++) {
        let currentVal = values[j];
        var found = false;
        for(var i = 0; i < parts.length; i++) {
            if (parts[i] == currentVal) {
                found = true;
                break;
            }
        }
        if (!found) {
            return false;
        }
    }
    return true;
}
function frequencyValidator(val) {
    let freq = val.toUpperCase();
    return (freq == 'DAILY' || freq == 'WEEKLY' || freq == 'MONTHLY' || freq == 'YEARLY');
}
function numericValidator(val, min, max) {
    try {
        let num = new Number(val);
        if (num < min) {
            return false;
        } else if(num > max) {
            return false;
        }
        return true;
    } catch (ex) {
        return false;
    }
}
function monthStepsValidator(val) {
    let monthLabels = "18 24 36 48 ";
    for(var i = 1; i < 13; i++) {
        monthLabels = monthLabels + i + " ";
    }
    let monthLabelParts = monthLabels.trim().split(" ");
    for(var i = 0; i < monthLabelParts.length; i++) {
        if (monthLabelParts[i] == val) {
            return true;
        }
    }
    return false;
}
function isDigit(c) {
    return c >= '0' && c <= '9'
}
function untilDateValidator() {
    let rule = ICAL.Recur.fromString(rrule);
    return rule.until != null;
}
function initRepeatCondition(startDate) {
    var untilProvided = false;
    let until = extractPart("UNTIL",
        function(val){
            if (untilDateValidator()) {
                untilProvided = true;
                let rule = ICAL.Recur.fromString(rrule);
                return rule.until.toJSDate().toISOString().split("-").join("");
            }else {
                return startDate.toISOString().split("-").join("");
            }
        }
    );
    document.getElementById('until-date').value = formatDateString(until.split('T')[0]);

    var countProvided = false;
    let count = extractPart("COUNT",
        function(val){
            if (numericValidator(val, 1, 999)) {
                countProvided = true;
                return val;
            } else {
                return 1;
            }
        }
    );
    document.getElementById('repeat-counter').value = count;
    let untilElement = document.getElementById('repeat-until');
    let occurrencesElement = document.getElementById('repeat-occurrences-counter');
    if (untilProvided) {
        occurrencesElement.style.display = 'none';
        untilElement.style.display = '';
        document.getElementById('repeat-condition-until').checked = true;
    }else if(countProvided) {
        occurrencesElement.style.display = '';
        untilElement.style.display = 'none';
        document.getElementById('repeat-condition-occurrences').checked = true;
    } else { //forever
        occurrencesElement.style.display = 'none';
        untilElement.style.display = 'none';
        document.getElementById('repeat-condition-forever').checked = true;
    }
}
function handleRepeatCondition() {
    let untilElement = document.getElementById('repeat-until');
    let occurrencesElement = document.getElementById('repeat-occurrences-counter');
    let repeatCondition = document.querySelector('input[name="repeat-condition"]:checked').value;
    var initialiseRepeatCondition = false;
    if (previousRepeatCondition != repeatCondition) {
        previousRepeatCondition = repeatCondition;
        initialiseRepeatCondition = true;
    }
    if (initialiseRepeatCondition) {
        occurrencesElement.style.display = 'none';
        untilElement.style.display = 'none';
    }

    if (repeatCondition == "forever") {
        return "";
    } else if (repeatCondition == "occurrences") {
        let counterElement = document.getElementById('repeat-counter');
        if (initialiseRepeatCondition) {
            occurrencesElement.style.display = '';
        }
        let occurrencesCounter = counterElement.value;
        if (numericValidator(occurrencesCounter, 1, 999)) {
            return ";COUNT=" + occurrencesCounter;
        } else {
            showRecurrenceError("Occurrence value is invalid");
            return "";
        }
    } else if (repeatCondition == "until") {
        let dateElement = document.getElementById('until-date');
        if (initialiseRepeatCondition) {
            untilElement.style.display = '';
        }
        let untilDate = dateElement.value;
        if (untilDate == "") {
            showRecurrenceError("Please select Date");
            return "";
        } else {
            let formattedDate = untilUTCTimeString(moment(untilDate + " 23:59:59"));
            return ";UNTIL=" + formattedDate;
        }
    }
}
function processRRULE(startDate) {
    resetRRULEUI();
    if (rrule== "" || rrule.includes("FREQ=DAILY")) {
        setHandler(function() {
            document.getElementById('freq-daily').selected = true;
            document.getElementById('daily-interval').style.display = '';
            let interval = extractPart("INTERVAL",
                function(val){
                    return numericValidator(val, 1, 30) ? val : 1;
                }
            );
            document.getElementById('daily-frequency-' + interval).selected = true;
            initRepeatCondition(startDate);
        }, function() {
            let rruleBuffer = "FREQ=DAILY"
            let dailyFrequency = document.getElementById('daily-frequency').value;
            rruleBuffer = rruleBuffer + ";INTERVAL=" + dailyFrequency;
            rruleBuffer = rruleBuffer + handleRepeatCondition();
	        return rruleBuffer;
        });
    } else if(rrule.includes("FREQ=WEEKLY")) {
        setHandler(function() {
            document.getElementById('freq-weekly').selected = true;
            document.getElementById('weekly-interval').style.display = '';
            document.getElementById('by-day-choices').style.display = '';
            let interval = extractPart("INTERVAL",
                function(val){
                    return numericValidator(val, 1, 26) ? val : 1;
                }
            );
            document.getElementById('weekly-frequency-' + interval).selected = true;
            initCheckBoxes('by-day', "BYDAY");
            initRepeatCondition(startDate);
        }, function() {
            let rruleBuffer = "FREQ=WEEKLY"
            let weeklyFrequency = document.getElementById('weekly-frequency').value;
            rruleBuffer = rruleBuffer + ";INTERVAL=" + weeklyFrequency;

            rruleBuffer = rruleBuffer + handleCheckBoxes(byDayLabelParts, 'by-day', 'BYDAY');
            rruleBuffer = rruleBuffer + handleRepeatCondition();
	        return rruleBuffer;
        });
    } else if(rrule.includes("FREQ=MONTHLY")) {
        var hasByDay = false;
        var hasByDate = false;
        document.getElementById('freq-monthly-by').style.display = '';
        document.getElementById('freq-monthly').selected = true;
        setHandler(function() {
            document.getElementById('monthly-interval').style.display = '';
            if (hasPart("BYMONTHDAY")) {
                hasByDate = true;
                document.getElementById('freq-by-date').selected = true;
                document.getElementById('monthly-by-date-choices').style.display = '';
            } else {
                hasByDay = true;
                document.getElementById('freq-by-day').selected = true;
                document.getElementById('monthly-by-day-choices').style.display = '';
            }
            let interval = extractPart("INTERVAL",
                function(val){
                    return monthStepsValidator(val) ? val : 1;
                }
            );
            document.getElementById('monthly-frequency-' + interval).selected = true;
            if (hasByDay) {
                initSelect('monthly-day', "BYDAY", function() {
                    return "1MO";
                });
            } else if (hasByDate) {
                initSelect('monthly-date', "BYMONTHDAY", function() {
                    return startDate.date();
                });
            }
            initRepeatCondition(startDate);
        }, function() {
            let rruleBuffer = "FREQ=MONTHLY"
            let monthlyFrequency = document.getElementById('monthly-frequency').value;
            rruleBuffer = rruleBuffer + ";INTERVAL=" + monthlyFrequency;
            if (hasByDay) {
                rruleBuffer = rruleBuffer + handleSelect(byMonthDayLabelParts, 'monthly-day', 'BYDAY');
            } else if (hasByDate) {
                rruleBuffer = rruleBuffer + handleSelect(byDateLabelParts, 'monthly-date', 'BYMONTHDAY');
            }
            rruleBuffer = rruleBuffer + handleRepeatCondition();
	        return rruleBuffer;
        });
    } else if(rrule.includes("FREQ=YEARLY")) {
        var hasByDay = false;
        var hasByDate = false;
        document.getElementById('freq-monthly-by').style.display = '';
        document.getElementById('freq-yearly').selected = true;
        setHandler(function() {
            document.getElementById('yearly-interval').style.display = '';
            if (hasPart("BYMONTHDAY")) {
                hasByDate = true;
                document.getElementById('freq-by-date').selected = true;
                document.getElementById('yearly-month-choice').style.display = '';
                document.getElementById('monthly-by-date-choices').style.display = '';
            } else {
                hasByDay = true;
                document.getElementById('freq-by-day').selected = true;
                document.getElementById('yearly-month-choice').style.display = '';
                document.getElementById('monthly-by-day-choices').style.display = '';
            }
            let interval = extractPart("INTERVAL",
                function(val){
                    return numericValidator(val, 1, 10) ? val : 1;
                }
            );
            document.getElementById('yearly-frequency-' + interval).selected = true;
            initSelect('yearly-month', "BYMONTH", function() {
                    return startDate.month() + 1;
            });
            if (hasByDay) {
                initSelect('monthly-day', "BYDAY", function() {
                    return "1MO";
                });
            } else if (hasByDate) {
                initSelect('monthly-date', "BYMONTHDAY", function() {
                    return startDate.date();
                });
            }
            initRepeatCondition(startDate);
        }, function() {
            let rruleBuffer = "FREQ=YEARLY"
            let yearlyFrequency = document.getElementById('yearly-frequency').value;
            rruleBuffer = rruleBuffer + ";INTERVAL=" + yearlyFrequency;
            let monthLabels = "";
            rruleBuffer = rruleBuffer + handleSelect(monthLabelParts, 'yearly-month', 'BYMONTH');
            if (hasByDay) {
                rruleBuffer = rruleBuffer + handleSelect(byMonthDayLabelParts, 'monthly-day', 'BYDAY');
            } else if (hasByDate) {
                rruleBuffer = rruleBuffer + handleSelect(byDateLabelParts, 'monthly-date', 'BYMONTHDAY');
            }
            rruleBuffer = rruleBuffer + handleRepeatCondition();
	        return rruleBuffer;
        });
    }
}
function initCheckBoxes(prefix, partName, defaultFunc) {
    initChoices(true, prefix, partName, defaultFunc);
}
function initSelect(prefix, partName, defaultFunc) {
    initChoices(false, prefix, partName, defaultFunc);
}
function initChoices(isCheckBoxes, prefix, partName, defaultFunc) {
    let byDay = extractPart(partName,
        function(val){
            return val;
        }
    );
    if (byDay.length > 0) {
        let byDayParts = byDay.split(',');
        for(var i = 0 ; i < byDayParts.length; i++) {
            let element = document.getElementById(prefix + '-' + byDayParts[i]);
            if (element != null) {
                if (isCheckBoxes) {
                    element.checked = true;
                } else {
                    element.selected = true;
                }
            }
        }
    } else {
        if (defaultFunc != null) {
            let val = defaultFunc();
            let element = document.getElementById(prefix + '-' + val);
            if (isCheckBoxes) {
                element.checked = true;
            } else {
                element.selected = true;
            }
        }
    }
}
function handleCheckBoxes(labelParts, prefix, partName) {
    return handleChoices(labelParts, prefix, partName)
}
function handleSelect(labelParts, prefix, partName) {
    return handleChoices(labelParts, prefix, partName)
}
function handleChoices(labelParts, prefix, partName) {
    var byDayBuffer = "";
    for(var i = 0 ; i < labelParts.length; i++) {
        let element = document.getElementById(prefix + '-' + labelParts[i]);
        if(element.checked || element.selected) {
            byDayBuffer = byDayBuffer + labelParts[i] + " ";
        }
    }
    byDayBuffer = byDayBuffer.trim().split(" ").join(",");
    if (byDayBuffer.length > 0) {
        return ";" + partName + "=" + byDayBuffer;
    }
    return "";
}
