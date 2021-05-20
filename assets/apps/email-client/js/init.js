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
        load(e.data.availableUsernames, e.data.userFolders, e.data.username
            , e.data.icalEventTitle, e.data.icalEvent);
    } else if (e.data.type == "respondToSendEmail") {
        respondToSendEmail(e.data.data);
    } else if (e.data.type == "respondToLoadFolder") {
        respondToLoadFolder(e.data.data, e.data.folderName);
    } else if (e.data.type == "respondToMoveEmail") {
        respondToMoveEmail(e.data.data, e.data.toFolder);
    } else if (e.data.type == "respondToMoveEmails") {
        respondToMoveEmails(e.data.data, e.data.toFolder);
    } else if (e.data.type == "respondToDeleteEmail") {
        respondToDeleteEmail(e.data.data, e.data.folder);
    } else if (e.data.type == "respondToDeleteEmails") {
        respondToDeleteEmails(e.data.data, e.data.folder);
    } else if (e.data.type == "respondToNewFolder") {
        respondToNewFolder(e.data.data);
    } else if (e.data.type == "respondToDeleteFolder") {
        respondToDeleteFolder(e.data.data);
    } else if (e.data.type == "respondToConfirmAction") {
        respondToConfirmAction(e.data.action, e.data.response);
    } else if (e.data.type == "respondToUpdateEmail") {
        respondToUpdateEmail();
    }
};
window.addEventListener('message', handler);
document.body.addEventListener('submit', onSubmit);

var unreadEmails = 0;
var starredEmails = 0;
var folderEmails = new Map();
var loadedFolderEmails = new Map();
var filteredEmails = [];
var userFolders = [];
var searchText = "";
var currentFolder = 'inbox';
var icalText = '';
var icalTitle = '';
var currentEmail = null;
var currentAttachmentFiles = [];
var currentlyReplyingTo = null;
var currentlyForwardingTo = null;

let toUsernames = [];
let ccUsernames = [];
let bccUsernames = [];

function resetTypeahead(fieldId, values) {
    $('#' + fieldId).tokenfield('setTokens', values);
}

function setTypeAhead(availableUsernames, fieldId, selectedUsernames) {
    selectedUsernames = [];
    let allNames = availableUsernames;
    var engine = new Bloodhound({
      datumTokenizer: Bloodhound.tokenizers.whitespace,
      queryTokenizer: Bloodhound.tokenizers.whitespace,
      local: allNames
    });

    engine.initialize();

    $('#' + fieldId).tokenfield({
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
    $('#' + fieldId).on('tokenfield:createtoken', function (event) {
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
    $('#' + fieldId).on('tokenfield:createdtoken', function (event) {
        selectedUsernames.push(event.attrs.value);
    });

    $('#' + fieldId).on('tokenfield:removedtoken', function (event) {
        selectedUsernames.pop(event.attrs.value);
    });
}

let addGotoInboxButton = document.getElementById('gotoInboxButton');
addGotoInboxButton.onclick=function(e) {
    gotoInbox();
};

let addGotoSentButton = document.getElementById('gotoSentButton');
addGotoSentButton.onclick=function(e) {
    gotoSent();
};

let addGotoTrashButton = document.getElementById('gotoTrashButton');
addGotoTrashButton.onclick=function(e) {
    gotoTrash();
};

let addGotoSpamButton = document.getElementById('gotoSpamButton');
addGotoSpamButton.onclick=function(e) {
    gotoSpam();
};

let addGotoArchiveButton = document.getElementById('gotoArchiveButton');
addGotoArchiveButton.onclick=function(e) {
    gotoArchive();
};

let addRefreshInboxButton = document.getElementById('refreshInboxButton');
addRefreshInboxButton.onclick=function(e) {
    refreshInbox();
};

let addSearchButton = document.getElementById('searchButton');
addSearchButton.onclick=function(e) {
    search();
};

let addToggleSelectAllButton = document.getElementById('toggleSelectAllButton');
addToggleSelectAllButton.onclick=function(e) {
    toggleSelectAll();
};

let addMoveToInboxButton = document.getElementById('toolbarInboxId');
addMoveToInboxButton.onclick=function(e) {
    moveToInbox();
};

let addDeleteMessagesButton = document.getElementById('deleteMessagesButton');
addDeleteMessagesButton.onclick=function(e) {
    deleteMessages();
};

let addMoveToSpamButton = document.getElementById('toolbarSpamId');
addMoveToSpamButton.onclick=function(e) {
    moveToSpam();
};

let addMoveToArchiveButton = document.getElementById('toolbarArchiveId');
addMoveToArchiveButton.onclick=function(e) {
    moveToArchive();
};

let addCreateNewFolderButton = document.getElementById('createNewFolderButton');
addCreateNewFolderButton.onclick=function(e) {
    createNewFolder();
};

let addOpenUploadDialogButton = document.getElementById('openUploadDialogButton');
addOpenUploadDialogButton.onclick=function(e) {
    openUploadDialog();
};
function openUploadDialog() {
    document.getElementById('uploadInput').click()
}

let addUploadInputButton = document.getElementById('uploadInput');
addUploadInputButton.onchange=function(event) {
    addAttachments(event.target.files);
};

let addSendEmailButton = document.getElementById('addSendEmailButton');
addSendEmailButton.onclick=function(e) {
    sendEmail();
};

let addDiscardEmailButton = document.getElementById('addDiscardEmailButton');
addDiscardEmailButton.onclick=function(e) {
    discardEmail();
};

let dropdownCreateNewFolderButton = document.getElementById('dropdownCreateNewFolderButton');
dropdownCreateNewFolderButton.onclick=function(e) {
    createNewFolder();
};

let addComposeNewEmailButton = document.getElementById('addComposeNewEmailButton');
addComposeNewEmailButton.onclick=function(e) {
    composeNewEmail();
};


function displaySpinner(schedule) {
    mainWindow.postMessage({type:"displaySpinner"}, origin);
}

function removeSpinner(schedule) {
    mainWindow.postMessage({type:"removeSpinner"}, origin);
}

function updateValue(id, value) {
    let element = document.getElementById(id);
    if (id == 'unreadEmailsTotal') {
        if (value == 0) {
            element.className = "badge";
        } else {
            element.className = "badge badge-danger";
        }
    } else {
        if (value == 0) {
            element.className = "badge";
        } else {
            element.className = "badge badge-info";
        }
    }
    element.innerText = value;
}
function updateEmailTotals() {
    unreadEmails = 0;
    starredEmails = 0;
    let inboxEmails = folderEmails.get('inbox');
    inboxEmails.forEach(email => {
        if (email.unread) {
            unreadEmails++;
        }
    });
    inboxEmails.forEach(email => {
        if (email.star) {
            starredEmails++;
        }
    });
    updateValue("unreadEmailsTotal", unreadEmails);
    updateValue("starredEmailsTotal", starredEmails);
}

function load(availableUsernames, folders, user, icalEventTitle, icalEvent) {
    currentFolder = 'inbox';
    icalTitle = icalEventTitle;
    icalText = icalEvent;
    let emailAddresses = availableUsernames.map(u => u + '@peergos.me');
    setTypeAhead(emailAddresses, 'to', toUsernames);
    setTypeAhead(emailAddresses, 'cc', ccUsernames);
    setTypeAhead(emailAddresses, 'bcc', bccUsernames);

    userFolders = folders.sort(function (a, b) { return a.name.localeCompare(b.name);});
    for(var i = 0; i < userFolders.length; i++) {
        folderEmails.set(userFolders[i].name, []);
    }

    //folders are lazily loaded
    folderEmails.set('sent', []);
    folderEmails.set('trash', []);
    folderEmails.set('spam', []);
    folderEmails.set('archive', []);

    addFoldersToNavBar();
    refreshInbox();
}
function isFolderLoaded(folderName) {
    return loadedFolderEmails.get(folderName) != null;
}
function setFolderLoaded(folderName) {
    loadedFolderEmails.set(folderName, []);
}
function filterEmails() {
    let newFilteredEmails = [];
    let that = this;
    filteredEmails.forEach(item => {
        if (item.subject.toLowerCase().indexOf(that.searchText) > -1) {
            newFilteredEmails.push(item);
        } else if (item.content.toLowerCase().indexOf(that.searchText) > -1) {
            newFilteredEmails.push(item);
        } else {
            item.attachments.forEach(attachment => {
                if (attachment.filename.toLowerCase().indexOf(that.searchText) > -1) {
                    newFilteredEmails.push(item);
                }
            });
        }
    });
    filteredEmails = newFilteredEmails;
    addEmailsToUI();
}
function truncateText(text, size) {
    return text.length > size ? text.substring(0,size-3) + '...' : text;
}
function toggleSelectAll() {
    console.log("toggleSelectAll");
    let selectAllElement = document.getElementById("selectAll");
    if (selectAllElement.src.endsWith("check-square-o.svg")) {
        selectAllElement.src = "./images/square-o.svg";
        selectAll(false);
    } else {
        selectAllElement.src = "./images/check-square-o.svg";
        selectAll(true);
    }
}
function selectAll(value) {
    filteredEmails.forEach(email => {
        email.selected = value;
        let id = 'selected-' + email.id;
        let selectItemImg = document.getElementById(id);
        if (selectItemImg != null) {
            if (value) {
                selectItemImg.src = "./images/check-square-o.svg";
            } else {
                selectItemImg.src = "./images/square-o.svg";
            }
        }
    });
}
function getSelected() {
    let selected = [];
    filteredEmails.forEach(email => {
        if (email.selected) {
            selected.push(email);
        }
    });
    return selected;
}
function addUserFoldersToDropdown(includeDetailView) {
    addFoldersToDropdown("moveToUserFoldersId", function(folder) {moveToFolder(folder);});
    if (includeDetailView) {
        addFoldersToDropdown("moveEmailToUserFoldersId", function(folder) {moveEmailToFolder(folder);});
    }
}
function addFoldersToDropdown(id, func) {
    let moveToFoldersList = document.getElementById(id);
    if (moveToFoldersList == null) {
        return;
    }
    moveToFoldersList.replaceChildren();
    userFolders.forEach(folder => {
        var a = document.createElement("a");
        a.className = "dropdown-item pressable";
        a.href="#";
        a.onclick = function() {
            func(folder);
        }

        var img = document.createElement("img");
        img.className = "fa-icon";
        img.src = "./images/folder.svg";
        a.appendChild(img);

        var text = document.createElement("text");
        text.innerText = ' move to ' + folder.name;
        a.appendChild(text);

        moveToFoldersList.appendChild(a);
    });
}
function addFoldersToNavBar() {
    let foldersList = document.getElementById("userFoldersId");
    foldersList.replaceChildren();
    userFolders.forEach(folder => {
        var item = document.createElement("li");
        item.className = "nav-item";

        var a = document.createElement("a");
        a.className = "nav-link pressable";
        item.appendChild(a);

        var img = document.createElement("img");
        img.className = "fa-icon";
        img.src = "./images/folder.svg";
        a.appendChild(img);

        var span = document.createElement("span");
        span.innerText = " " + folder.name;
        span.onclick=function(e) {
            navigateToFolder(folder);
        };
        a.appendChild(span);

        var span3 = document.createElement("span");
        span3.className = "badge badge-delete";
        span3.innerText = "X";
        span3.onclick=function(e) {
            deleteFolder(folder);
        };
        a.appendChild(span3);

        foldersList.appendChild(item);
    });
}
function fromList(array) {
    return array.join(", ");
}
function addEmailsToUI() {
    addUserFoldersToDropdown(false);
    let messageList = document.getElementById("messages");
    messageList.replaceChildren();
    filteredEmails.forEach(email => {
        var item = document.createElement("li");
        let itemClassNames = email.unread ? 'message unread' : 'message';
        item.className = itemClassNames;
        var a = document.createElement("a");
        item.appendChild(a);

        var actions = document.createElement("div");
        actions.className = "actions";
        a.appendChild(actions);

        var selected = document.createElement("span");
        actions.appendChild(selected);
        selected.className = "action";
        var imgSelected = document.createElement("img");
        imgSelected.id = 'selected-' + email.id;
        imgSelected.onclick=function(e) {
            if (imgSelected.src.endsWith("check-square-o.svg")) {
                imgSelected.src = "./images/square-o.svg";
                email.selected = false;
            } else {
                imgSelected.src = "./images/check-square-o.svg";
                email.selected = true;
            }
        };
        selected.appendChild(imgSelected);
        imgSelected.src = email.selected ? "./images/check-square-o.svg" : "./images/square-o.svg";
        imgSelected.className = "fa-icon";

        if (currentFolder == 'inbox') {
            var unread = document.createElement("span");
            actions.appendChild(unread);
            unread.className = "action";
            var imgUnread = document.createElement("img");
            imgUnread.onclick=function(e) {
                if (imgUnread.src.endsWith("envelope.svg")) {
                    imgUnread.src = "./images/envelope-o.svg";
                    email.unread = false;
                    unreadEmails--;
                    item.className = 'message';
                } else {
                    imgUnread.src = "./images/envelope.svg";
                    email.unread = true;
                    unreadEmails++;
                    item.className = 'message unread';
                }
                requestUpdateEmail(email);
            };
            unread.appendChild(imgUnread);
            imgUnread.src = email.unread ? "./images/envelope.svg" : "./images/envelope-o.svg";
            imgUnread.className = "fa-icon";

            var star = document.createElement("span");
            actions.appendChild(star);
            star.className = "action";
            var imgStar = document.createElement("img");
            imgStar.onclick=function(e) {
                if (imgStar.src.endsWith("star.svg")) {
                    imgStar.src = "./images/star-o.svg";
                    imgStar.className = "fa-icon"
                    email.star = false;
                    starredEmails--;
                } else {
                    imgStar.src = "./images/star.svg";
                    imgStar.className = "fa-icon filter-yellow"
                    email.star = true;
                    starredEmails++;
                }
                requestUpdateEmail(email);
            };
            star.appendChild(imgStar);

            if (email.star) {
                imgStar.src = "./images/star.svg";
                imgStar.className = "fa-icon filter-yellow"
            } else {
                imgStar.src = "./images/star-o.svg";
                imgStar.className = "fa-icon";
            }
        }
        var listItem = document.createElement("div");
        a.appendChild(listItem);
        listItem.onclick=function() {
            openEmail(email);
        };

        var header = document.createElement("div");
        header.className = "header";
        listItem.appendChild(header);
        var from = document.createElement("span");
        header.appendChild(from);
        from.className = "from";
        from.innerText = fromList([email.from]);

        var date = document.createElement("span");
        date.className = "date";
        header.appendChild(date);

        var dateLine = document.createElement("span");
        date.appendChild(dateLine);

        if (email.attachments.length > 0) {
            var attachment = document.createElement("img");
            dateLine.appendChild(attachment);
            attachment.src = "./images/paperclip.svg";
            attachment.className = "fa-icon";
        }
        if (email.icalEvent.length > 0) {
            var attachment = document.createElement("img");
            dateLine.appendChild(attachment);
            attachment.src = "./images/calendar.svg";
            attachment.className = "fa-icon";
        }
        var formattedDate = document.createElement("text");
        dateLine.appendChild(formattedDate);
        formattedDate.innerText = formatDateTime(email.timestamp);

        var subject = document.createElement("div");
        listItem.appendChild(subject);
        subject.className = "subject";
        subject.innerText = email.subject;

        var description = document.createElement("div");
        listItem.appendChild(description);
        description.className = "description";
        description.innerText = truncateText(email.content, 50);

        messageList.appendChild(item);
    });
}
function requestUpdateEmail(email) {
    mainWindow.postMessage({action: "requestUpdateEmail", data: email, folder: currentFolder}, origin);
}
function respondToUpdateEmail() {
    updateValue("unreadEmailsTotal", unreadEmails);
    updateValue("starredEmailsTotal", starredEmails);
}
function formatDateTime(dateTime) {
    let date = new Date(dateTime + "+00:00");//adding UTC TZ in ISO_OFFSET_DATE_TIME ie 2021-12-03T10:25:30+00:00
    let formatted = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()
        + ' ' + (date.getHours() < 10 ? '0' : '') + date.getHours()
        + ':' + (date.getMinutes() < 10 ? '0' : '') + date.getMinutes()
        + ':' + (date.getSeconds() < 10 ? '0' : '') + date.getSeconds();
    return formatted;
}

function addEmailToUI(email) {
    currentEmail = email;

    addUserFoldersToDropdown(true);
    let replyToElement = document.getElementById("replyToId");
    replyToElement.onclick=function() {
        replyTo(email);
    };

    let replyToAllElement = document.getElementById("replyToAll");
    replyToAllElement.onclick=function() {
        replyToAll(email);
    };

    let forwardToElement = document.getElementById("forwardTo");
    forwardToElement.onclick=function() {
        forwardTo(email);
    };

    let trashElement = document.getElementById("moveToTrashId");
    trashElement.onclick=function() {
        moveEmailToTrash(email);
    };

    let moveToSpamElement = document.getElementById("moveToSpamId");
    moveToSpamElement.onclick=function() {
        moveEmailToSpam(email);
    };

    let moveToArchiveElement = document.getElementById("moveToArchiveId");
    moveToArchiveElement.onclick=function() {
        moveEmailToArchive(email);
    };

    let subject = document.getElementById("emailSubjectId");
    subject.innerText = email.subject;

    let from = document.getElementById("fromId");
    from.innerText = email.from;

    let cc = document.getElementById("ccId");
    cc.innerText = fromList(email.cc);

    let dateTime = document.getElementById("dateTimeId");
    dateTime.innerText = formatDateTime(email.timestamp);

    let content = document.getElementById("contentId");
    content.innerText = email.content;

    let attachmentCount = document.getElementById("attachmentCountId");
    attachmentCount.innerText = "(" + email.attachments.length + ")";

    let ical = document.getElementById("icalId");
    if (email.icalEvent.length > 0) {
        ical.classList.remove("hide");
        let importEl = document.getElementById("importCalendarEventId");
        importEl.onclick=function() {
            importCalendarEvent(email.icalEvent);
        };
    } else {
        ical.classList.add("hide");
    }
    let attachments = document.getElementById("attachmentsId");
    attachments.replaceChildren();
    email.attachments.forEach(attachment => {

        var item = document.createElement("div");
        item.className = "attachment";

        var filename = document.createElement("b");
        filename.innerText = attachment.filename;
        item.appendChild(filename);

        var fileSize = document.createElement("i");
        fileSize.innerText = "(" + convertBytesToHumanReadable(attachment.size) + ")";
        item.appendChild(fileSize);

        var attachmentMenu = document.createElement("span");
        attachmentMenu.className = "attachment-menu";
        item.appendChild(attachmentMenu);

        var download = document.createElement("a");
        download.innerText = 'Download';
        download.href="#";
        download.onclick = function() {
            downloadAttachment(attachment);
        }
        attachmentMenu.appendChild(download);

        attachments.appendChild(item);
    });
}
function importCalendarEvent(icalEvent) {
    mainWindow.postMessage({action: "requestImportCalendarEvent", icalEvent: icalEvent}, origin);
}
function refreshInbox() {
    mainWindow.postMessage({action: "requestRefreshInbox"}, origin);
}
function onSubmit(e) {
  e.preventDefault();
  search();
  return false;
}
function search() {
    searchText = document.getElementById("searchText").value.trim().toLowerCase();
    if (searchText.length == 0) {
        filteredEmails = folderEmails.get(currentFolder);
        addEmailsToUI();
    } else {
        filterEmails();
    }
}
function removeItemsFromArray(selected, folder) {
    selected.forEach(selectedItem => {
        let index = folder.findIndex(v => v.id === selectedItem.id);
        if (index > -1) {
            folder.splice(index, 1);
        }
    });
}
function appendItemsToArray(newItems, existingItems) {
    newItems.forEach( item => {
        item.selected = false;
    });
    let updatedArray = newItems.concat(existingItems);
    let sorted = updatedArray.sort(function (a, b) {
            let aDate = new Date(a.timestamp);
            let bDate = new Date(b.timestamp);
            let res = aDate < bDate;
            return bDate - aDate;
        });
    return sorted;
}
function deleteMessages() {
    let selected = getSelected();
    if (selected.length > 0) {
        if (currentFolder == 'trash') {
            requestDeleteEmails(selected, currentFolder);
        } else {
            requestMoveEmails(selected, currentFolder, 'trash');
        }
    }
}
function requestMoveEmails(emails, fromFolder, toFolder) {
    emails.forEach( item => {
        item.selected = false;
    });
    mainWindow.postMessage({action: "requestMoveEmails", data: emails,
        fromFolder: fromFolder, toFolder: toFolder}, origin);
}
function requestMoveEmail(email, fromFolder, toFolder) {
    email.selected = false;
    mainWindow.postMessage({action: "requestMoveEmail", data: email,
        fromFolder: fromFolder, toFolder: toFolder}, origin);
}
function requestDeleteEmails(emails, folder) {
    emails.forEach( item => {
        item.selected = false;
    });
    mainWindow.postMessage({action: "requestDeleteEmails", data: emails,
        folder: folder}, origin);
}
function requestDeleteEmail(email, folder) {
    email.selected = false;
    mainWindow.postMessage({action: "requestDeleteEmail", data: email,
        folder: folder}, origin);
}
function respondToDeleteEmails(emails, fromFolder) {
    let folder = folderEmails.get(fromFolder);
    removeItemsFromArray(emails, folder);
    loadFolder(fromFolder);
}

function respondToDeleteEmail(email, fromFolder) {
    let folder = folderEmails.get(fromFolder);
    removeItemsFromArray([email], folder);
    loadFolder(fromFolder);
}
function respondToMoveEmails(emails, toFolder) {
    if (isFolderLoaded(toFolder)) {
        let trash = folderEmails.get(toFolder);
        let updatedTrash = appendItemsToArray(emails, trash);
        folderEmails.set(toFolder, updatedTrash);
    }
    let folder = folderEmails.get(currentFolder);
    removeItemsFromArray(emails, folder);
    loadFolder(currentFolder);
}

function respondToMoveEmail(email, toFolder) {
    if (isFolderLoaded(toFolder)) {
        let trash = folderEmails.get(toFolder);
        let updatedTrash = appendItemsToArray([email], trash);
        folderEmails.set(toFolder, updatedTrash);
    }
    let folder = folderEmails.get(currentFolder);
    removeItemsFromArray([email], folder);
    loadFolder(currentFolder);
}

function createNewFolder() {
    mainWindow.postMessage({action: "requestNewFolder"}, origin);
}

function respondToNewFolder(userFolder) {
    userFolders.push(userFolder);
    userFolders = userFolders.sort(function (a, b) { return a.name.localeCompare(b.name);});

    addFoldersToNavBar();
    addUserFoldersToDropdown(true);
}

function deleteFolder(folder) {
    mainWindow.postMessage({action: "requestDeleteFolder", folderName: folder.name}, origin);
}

function respondToDeleteFolder(folderName) {
    let index = userFolders.findIndex(v => v.name === folderName);
    if (index > -1) {
        userFolders.splice(index, 1);
        folderEmails.delete(folderName)
        loadedFolderEmails.delete(folderName)
    }
    addFoldersToNavBar();
    addUserFoldersToDropdown(true);
}

function moveToInbox() {
    let selected = getSelected();
    if (selected.length > 0) {
        requestMoveEmails(selected, currentFolder, 'inbox');
    }
}

function moveToSpam() {
    let selected = getSelected();
    if (selected.length > 0) {
        requestMoveEmails(selected, currentFolder, 'spam');
    }
}
function moveToArchive() {
    let selected = getSelected();
    if (selected.length > 0) {
        requestMoveEmails(selected, currentFolder, 'archive');
    }
}
function moveToFolder(folder) {
    let selected = getSelected();
    if (currentFolder == folder.name) {
        return;
    }
    if (selected.length > 0) {
        requestMoveEmails(selected, currentFolder, folder.name);
    }
}
function clearEmailFields(keepIcal) {

    if (!keepIcal) {
        icalText = '';
        icalTitle = '';
    }
    document.getElementById('uploadInput').value = "";
    currentEmail = null;
    currentAttachmentFiles = [];

    currentlyReplyingTo = null;
    currentlyForwardingTo = null;

    document.getElementById("to").value = '';
    document.getElementById("cc").value = '';
    document.getElementById("bcc").value = '';
    document.getElementById("subject").value = '';
    document.getElementById("message").value = '';

    resetTypeahead("to", []);
    resetTypeahead("cc", []);
    resetTypeahead("bcc", []);
}
function toList(str) {
    let uniqueList = [];
    splitAndAppend(str, ",", uniqueList);
    splitAndAppend(str, ";", uniqueList);
    splitAndAppend(str, " ", uniqueList);
    return uniqueList;
}
function splitAndAppend(str, deliminator, uniqueList) {
    let list = str.trim().split(deliminator);
    list.forEach(fullItem => {
        let item = fullItem.trim();
        if (item.length > 0 && item.indexOf(' ') == -1 && item.indexOf(',') == -1 && item.indexOf(';') == -1) {
            let index = uniqueList.findIndex(v => v === item);
            if (index == -1) {
                uniqueList.push(item.trim());
            }
        }
    });
}
function sendEmail() {

    let to = toList(document.getElementById("to").value.trim());
    let cc = toList(document.getElementById("cc").value.trim());
    let bcc = toList(document.getElementById("bcc").value.trim());
    let subject = document.getElementById("subject").value.trim();
    let body = document.getElementById("message").value.trim();

    if(to.length == 0) {
        requestShowMessage("Message is missing a To: address");
        return;
    }
    if(subject.length == 0) {
        requestShowMessage("Message has no subject!");
        return;
    }
    if(body.length == 0) {
        requestShowMessage("Message has no content!");
        return;
    }

    let allTasks = [];
    for(var i = 0; i < currentAttachmentFiles.length; i++) {
        allTasks.push(uploadFile(currentAttachmentFiles[i]));
    }
    Promise.all(allTasks)
        .then(attachments => {
                let data =
                {   subject: subject
                    , to: to, cc: cc, bcc: bcc
                    , content: body
                    , unread: false, star: false
                    , attachments: attachments
                    , icalEvent: icalText
                    , replyingToEmail: currentlyReplyingTo
                    , forwardingToEmail: currentlyForwardingTo
                };
                requestSendEmail(data);
        });
}

function uploadFile(file) {
    return new Promise(function(resolve, reject) {
        let binFilereader = new FileReader();
        binFilereader.file_name = file.name;
        binFilereader.onload = function(){
            resolve({filename: file.name, size: file.size, type: file.type, data: new Int8Array(this.result)});
        };
        binFilereader.readAsArrayBuffer(file);
    });
}

function requestSendEmail(data) {
    mainWindow.postMessage({action: "requestSendEmail", data: data}, origin);
}
function respondToSendEmail(data) {
    if (isFolderLoaded('sent')) {
        let sendFolder = folderEmails.get('sent');
        sendFolder.unshift(data);
    }
    clearEmailFields(false);
    gotoInbox();
}
function discardEmail() {
    mainWindow.postMessage({type: "requestConfirmAction", action: 'discardEmail', message: 'Are you sure you want to discard this Message?'}, origin);
}
function respondToConfirmAction(action, response) {
    if (response) {
        if (action == 'discardEmail') {
            clearEmailFields(false);
            gotoInbox();
        }
    }
}

function replyTo(email) {
    composeEmail([email.from], email.cc, [], email, null);
    document.getElementById("to").value = email.from;
    document.getElementById("subject").value = "Re:" + email.subject;
    document.getElementById("message").value = email.content;
}
function replyToAll(email) {
    composeEmail([email.from], email.cc, [], email, null);
    document.getElementById("to").value = email.from;
    document.getElementById("cc").value = email.cc;
    document.getElementById("subject").value = "Re:" + email.subject;
    document.getElementById("message").value = email.content;
}
function forwardTo(email) {
    composeEmail([], [], [], null, email);
    document.getElementById("subject").value = "Fwd:" + email.subject;
    document.getElementById("message").value = email.content;
}
function moveEmailToTrash(email) {
    if (currentFolder == 'trash') {
        requestDeleteEmail(email, currentFolder);
    } else {
        requestMoveEmail(email, currentFolder, 'trash');
    }
}
function moveEmailToSpam(email) {
    requestMoveEmail(email, currentFolder, 'spam');
}
function moveEmailToArchive(email) {
    requestMoveEmail(email, currentFolder, 'archive');
}
function moveEmailToFolder(folder) {
    requestMoveEmail(currentEmail, currentFolder, folder.name);
}

function downloadAttachment(attachment) {
    mainWindow.postMessage({action: "requestDownloadAttachment", attachment: attachment}, origin);
}
function composeNewEmail() {
    composeEmail([], [], [], null, null);
}

function composeEmail(toList, ccList, bccList, replyingTo, forwardingTo) {

    let icalEvent = document.getElementById('icalEvent');
    if (icalText.length > 0) {
        clearEmailFields(true);
        document.getElementById("subject").value = 'Event: ' + icalTitle;
        document.getElementById("icalEventTitleId").innerText = icalTitle;
        icalEvent.classList.remove("hide");
    } else {
        icalEvent.classList.add("hide");
        clearEmailFields(false);
    }

    updateAttachmentUI();

    currentlyReplyingTo = replyingTo;
    currentlyForwardingTo = forwardingTo;

    let emailList = document.getElementById("email-list");
    emailList.classList.add("hide");
    emailList.classList.remove("display-block");

    let emailDetail = document.getElementById("email-message-detail");
    emailDetail.classList.add("hide");
    emailDetail.classList.remove("display-block");

    let composeEmail = document.getElementById("email-message");
    composeEmail.classList.remove("hide");
    composeEmail.classList.add("display-block");

    resetTypeahead("to", toList);
    resetTypeahead("cc", ccList);
    resetTypeahead("bcc", bccList);
}

function openEmail(email) {
    let emailList = document.getElementById("email-list");
    emailList.classList.add("hide");
    emailList.classList.remove("display-block");

    let composeEmail = document.getElementById("email-message");
    composeEmail.classList.add("hide");
    composeEmail.classList.remove("display-block");

    let emailDetail = document.getElementById("email-message-detail");
    emailDetail.classList.remove("hide");
    emailDetail.classList.add("display-block");

    addEmailToUI(email);
}
function resetSearch() {
    searchText = "";
    document.getElementById("searchText").value = searchText;
}
function capitalise(text) {
    let firstLetter = text.substring(0,1).toUpperCase();
    return firstLetter + text.substring(1);
}

function respondToLoadFolder(emails, folderName) {
    folderEmails.set(folderName, emails);
    setFolderLoaded(folderName);
    loadFolder(folderName);
    if (folderName == 'inbox') {
        updateEmailTotals();
        if (icalText.length > 0) {
            composeEmail([], [], [], null, null);
        }
    }
}

function loadFolder(folderName) {
    currentEmail = null;
    resetSearch();
    currentFolder = folderName;
    if(isFolderLoaded(folderName)) {

        let emailList = document.getElementById("email-list");
        emailList.classList.remove("hide");
        emailList.classList.add("display-block");

        let composeEmail = document.getElementById("email-message");
        composeEmail.classList.add("hide");
        composeEmail.classList.remove("display-block");

        let emailDetail = document.getElementById("email-message-detail");
        emailDetail.classList.add("hide");
        emailDetail.classList.remove("display-block");

        let folderNameElement = document.getElementById("currentFolderId");
        folderNameElement.innerText = capitalise(folderName);
        let refreshButtonElement = document.getElementById("refreshButtonId");
        let toolbarInboxElement = document.getElementById("toolbarInboxId");
        if (folderName == 'inbox') {
            refreshButtonElement.classList.remove("hide");
            refreshButtonElement.classList.add("display-block");
            toolbarInboxElement.classList.add("hide");
        } else {
            refreshButtonElement.classList.add("hide");
            refreshButtonElement.classList.remove("display-block");
            toolbarInboxElement.classList.remove("hide");
        }
        let toolbarSpamElement = document.getElementById("toolbarSpamId");
        if (folderName == 'spam') {
            toolbarSpamElement.classList.add("hide");
        } else {
            toolbarSpamElement.classList.remove("hide");
        }
        let toolbarArchiveElement = document.getElementById("toolbarArchiveId");
        if (folderName == 'archive') {
            toolbarArchiveElement.classList.add("hide");
        } else {
            toolbarArchiveElement.classList.remove("hide");
        }

        filteredEmails = folderEmails.get(folderName);
        addEmailsToUI();
    } else {
        requestLoadFolder(folderName);
    }
}
function requestLoadFolder(folderName) {
  mainWindow.postMessage({action: "requestLoadFolder", folderName: folderName}, origin);
}

function requestShowMessage(message) {
  mainWindow.postMessage({action: "requestShowMessage", message: message}, origin);
}

function gotoInbox() {
    loadFolder('inbox');
}

function gotoSent() {
    loadFolder('sent');
}

function gotoTrash() {
    loadFolder('trash');
}

function gotoSpam() {
    loadFolder('spam');
}

function gotoArchive() {
    loadFolder('archive');
}
function navigateToFolder(folder) {
    loadFolder(folder.name);
}

function addAttachments(files) {
    for(var i = 0; i < files.length; i++) {
        currentAttachmentFiles.push(files[i]);
    }
    updateAttachmentUI();
}

function updateAttachmentUI() {
    let element = document.getElementById('attachmentId');
    element.replaceChildren();
    for(var i = 0; i < currentAttachmentFiles.length; i++) {
        let item = currentAttachmentFiles[i];
        let json = {file: item.name, size: item.size, type: item.type};
        var img = document.createElement("img");
        img.className = "fa-icon";
        img.src = "./images/trash-o.svg";
        img.onclick=function(e) {
            removeAttachment(json);
        };
        element.appendChild(img);

        var text = document.createElement("text");
        text.innerText = " " + item.name + ' (' + convertBytesToHumanReadable(item.size) + ')  ';
        element.appendChild(text);
    };
}

function removeAttachment(json) {
    let index = currentAttachmentFiles.findIndex(v => v.name === json.name && v.size === json.size && v.type === json.type);
    if (index > -1) {
        currentAttachmentFiles.splice(index, 1);
    }
    updateAttachmentUI();
}

function roundToDisplay(x) {
    return Math.round(x * 100)/100;
}

function convertBytesToHumanReadable(sizeInBytes) {
    let bytes = Number(sizeInBytes);
    if (bytes < 1024)
    return bytes + " Bytes";
    if (bytes < 1024*1024)
    return this.roundToDisplay(bytes/1024) + " KiB";
    if (bytes < 1024*1024*1024)
    return this.roundToDisplay(bytes/1024/1024) + " MiB";
    return this.roundToDisplay(bytes/1024/1024/1024) + " GiB";
}

