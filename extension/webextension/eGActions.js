/***** BEGIN LICENSE BLOCK *****
Version: MPL 1.1/GPL 2.0/LGPL 2.1

The contents of this file are subject to the Mozilla Public License Version
1.1 (the "License"); you may not use this file except in compliance with
the License. You may obtain a copy of the License at
http://www.mozilla.org/MPL/

Software distributed under the License is distributed on an "AS IS" basis,
WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
for the specific language governing rights and limitations under the
License.

The Original Code is easyGestures N.

The Initial Developer of the Original Code is ngdeleito.

Contributor(s):
  Jens Tinz, his portions are Copyright (C) 2002. All Rights Reserved.
  Ons Besbes.

Alternatively, the contents of this file may be used under the terms of
either the GNU General Public License Version 2 or later (the "GPL"), or
the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
in which case the provisions of the GPL or the LGPL are applicable instead
of those above. If you wish to allow use of your version of this file only
under the terms of either the GPL or the LGPL, and not to allow others to
use your version of this file under the terms of the MPL, indicate your
decision by deleting the provisions above and replace them with the notice
and other provisions required by the GPL or the LGPL. If you do not delete
the provisions above, a recipient may use your version of this file under
the terms of any one of the MPL, the GPL or the LGPL.

***** END LICENSE BLOCK *****/


// This file provides the following hierarchy of Actions and the eGActions
// object, containing the actions available in easyGestures N

// Action
//  ^
//  |-- EmptyAction
//  |-- ShowExtraMenuAction
//  |-- DocumentContainsImagesDisableableAction
//  |-- DisableableAction
//       ^
//       |-- OtherTabsExistDisableableAction
//       |-- CanGoUpDisableableAction
//       |-- LinkExistsDisableableAction
//       |-- DailyReadingsDisableableAction
//       |-- NumberedAction
//       |    ^
//       |    |-- LoadURLAction
//       |    |-- RunScriptAction
//       |-- ImageExistsDisableableAction
//       |-- DisableableCommandAction

/* exported eGActions */
/* global Components, browser, Services, eGContext, eGPrefs, Downloads,
          eGUtils */

// Components.utils.import("resource://gre/modules/Services.jsm");
// Components.utils.import("chrome://easygestures/content/eGPrefs.jsm");

function Action(name, action, startsNewGroup, nextAction) {
  this._name = name;
  this.run = function() {
    return new Promise(resolve => {
      resolve(action.call(this));
    }).then(response => {
      return response === undefined ? {} : response;
    });
  };
  
  // startsNewGroup and nextAction are used in options.js to display a sorted
  // list of available actions
  this.startsNewGroup = startsNewGroup;
  this.nextAction = nextAction;
  
  this.isExtraMenuAction = false;
}
Action.prototype = {
  constructor: Action,
  
  increasingZoomLevels: [0.3, 0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.2, 1.33, 1.5, 1.7,
                         2, 2.4, 3],
  decreasingZoomLevels: [3, 2.4, 2, 1.7, 1.5, 1.33, 1.2, 1.1, 1, 0.9, 0.8, 0.67,
                         0.5, 0.3],
  
  isDisabled: function() {
    return new Promise(resolve => {
      resolve(false);
    });
  },
  
  getTooltipLabel: function() {
    return browser.i18n.getMessage(this._name);
  },
  
  getLocalizedActionName: function() {
    return this.getTooltipLabel();
  },
  
  getActionStatus: function() {},
  
  // helper functions
  
  _performOnCurrentTab: function(aFunction) {
    return browser.tabs.query({
      active: true,
      currentWindow: true
    }).then(tabs => {
      return aFunction(tabs[0]);
    });
  },
  
  _sendPerformActionMessage: function(options) {
    return {
      runActionName: this._name,
      runActionOptions: options
    };
  },
  
  _getFileForSavingData: function(filter, defaultName) {
    const nsIFilePicker = Components.interfaces.nsIFilePicker;
    var fp = Components.classes["@mozilla.org/filepicker;1"]
                       .createInstance(nsIFilePicker);
    var window = Services.wm.getMostRecentWindow("navigator:browser");
    
    fp.init(window, null, nsIFilePicker.modeSave);
    fp.appendFilters(filter);
    fp.defaultString = defaultName;
    var returnValue = fp.show();
    if (returnValue === nsIFilePicker.returnOK || returnValue === nsIFilePicker.returnReplace) {
      return fp.file;
    }
    else {
      return null;
    }
  },
  
  _saveContentFromLink: function(link, filter) {
    var uri = Services.io.newURI(link, null, null);
    var file = this._getFileForSavingData(
                 filter,
                 uri.path.substring(uri.path.lastIndexOf("/") + 1));
    
    if (file !== null) {
      Components.utils.import("resource://gre/modules/Downloads.jsm");
      Downloads.fetch(uri, file);
    }
  },
  
  _openURLOn: function(url, on, newTabShouldBeActive) {
    switch (on) {
      case "curTab":
        browser.tabs.update({
          url: url
        });
        break;
      case "newTab":
        browser.tabs.create({
          active: newTabShouldBeActive,
          url: url
        });
        break;
      case "newWindow":
        browser.windows.create({
          url: url
        });
        break;
    }
  }
};

function EmptyAction(startsNewGroup, nextAction) {
  Action.call(this, "empty", function() {}, startsNewGroup, nextAction);
}
EmptyAction.prototype = Object.create(Action.prototype);
EmptyAction.prototype.constructor = EmptyAction;
EmptyAction.prototype.getLocalizedActionName = function() {
  return browser.i18n.getMessage("emptyActionName");
};

function ShowExtraMenuAction(startsNewGroup, nextAction) {
  Action.call(this, "showExtraMenu", function() {}, startsNewGroup, nextAction);
  
  this.isExtraMenuAction = true;
}
ShowExtraMenuAction.prototype = Object.create(Action.prototype);
ShowExtraMenuAction.prototype.constructor = ShowExtraMenuAction;

function DisableableAction(name, action, isDisabled, startsNewGroup, nextAction) {
  Action.call(this, name, action, startsNewGroup, nextAction);
  
  this.isDisabled = isDisabled;
}
DisableableAction.prototype = Object.create(Action.prototype);
DisableableAction.prototype.constructor = DisableableAction;
DisableableAction.prototype.getActionStatus = function() {
  return {
    messageName: "setDisableableActionStatus",
    status: this.isDisabled()
  };
};

function OtherTabsExistDisableableAction(name, action, startsNewGroup, nextAction) {
  DisableableAction.call(this, name, action, function() {
    return browser.tabs.query({
      currentWindow: true
    }).then(tabs => {
      return tabs.length <= 1;
    });
  }, startsNewGroup, nextAction);
}
OtherTabsExistDisableableAction.prototype = Object.create(DisableableAction.prototype);
OtherTabsExistDisableableAction.prototype.constructor = OtherTabsExistDisableableAction;

function CanGoUpDisableableAction(name, action, startsNewGroup, nextAction) {
  DisableableAction.call(this, name, action, function() {
    return this._performOnCurrentTab(function(currentTab) {
      let url = new URL(currentTab.url);
      return url.pathname === "/";
    });
  }, startsNewGroup, nextAction);
}
CanGoUpDisableableAction.prototype = Object.create(DisableableAction.prototype);
CanGoUpDisableableAction.prototype.constructor = CanGoUpDisableableAction;

function LinkExistsDisableableAction(name, action, startsNewGroup, nextAction) {
  DisableableAction.call(this, name, action, function() {
    return new Promise(resolve => {
      return resolve(!eGContext.anchorElementExists);
    });
  }, startsNewGroup, nextAction);
}
LinkExistsDisableableAction.prototype = Object.create(DisableableAction.prototype);
LinkExistsDisableableAction.prototype.constructor = LinkExistsDisableableAction;

function DailyReadingsDisableableAction(startsNewGroup, nextAction) {
  DisableableAction.call(this, "dailyReadings", function() {
    function traverseSubTree(node) {
      if (node.children === undefined) {
        browser.tabs.create({
          active: false,
          url: node.url
        });
      }
      else {
        node.children.forEach(subnode => {
          traverseSubTree(subnode);
        });
      }
    }
    
    traverseSubTree(this.rootNode);
  }, function() {
    return browser.runtime.sendMessage({
      messageName: "query_eGPrefs",
      methodName: "getDailyReadingsFolderName"
    }).then(async aMessage => {
      let folderName = aMessage.response;
      if (folderName === "") {
        return true;
      }
      
      let foundBookmarks = await browser.bookmarks.search({
        title: folderName
      });
      return foundBookmarks.length === 0 ||
             browser.bookmarks.getSubTree(foundBookmarks[0].id)
                              .then(rootNode => {
               this.rootNode = rootNode[0];
               return rootNode[0].children === undefined;
             });
    });
  }, startsNewGroup, nextAction);
}
DailyReadingsDisableableAction.prototype = Object.create(DisableableAction.prototype);
DailyReadingsDisableableAction.prototype.constructor = DailyReadingsDisableableAction;

function NumberedAction(namePrefix, number, action, startsNewGroup, nextAction) {
  DisableableAction.call(this, namePrefix + number, function() {
    return browser.runtime.sendMessage({
      messageName: "query_eGPrefs",
      methodName: "getLoadURLOrRunScriptPrefValue",
      parameter: this._name
    }).then(aMessage => {
      return this._performOnCurrentTab(currentTab => {
        let prefValue = aMessage.response;
        let content = prefValue[1];
        content = content.replace("%s", eGContext.selection);
        content = content.replace("%u", currentTab.url);
        return action.call(this, content,
                           3 in prefValue ? prefValue[3] : undefined);
      });
    });
  }, function() {
    return browser.runtime.sendMessage({
      messageName: "query_eGPrefs",
      methodName: "getLoadURLOrRunScriptPrefValue",
      parameter: this._name
    }).then(aMessage => {
      return aMessage.response[1] === "";
    });
  }, startsNewGroup, nextAction);
  
  this._number = number;
}
NumberedAction.prototype = Object.create(DisableableAction.prototype);
NumberedAction.prototype.constructor = NumberedAction;
NumberedAction.prototype.getTooltipLabel = function() {
  // var prefValue = eGPrefs.getLoadURLOrRunScriptPrefValue(this._name);
  // var label = prefValue[0];
  // if (label !== "") {
  //   // if this action has already a label given by the user, then use it
  //   return label;
  // }
  // otherwise use the default label
  return browser.i18n.getMessage(this._name);
};

function LoadURLAction(number, startsNewGroup, nextAction) {
  NumberedAction.call(this, "loadURL", number,
    function(URL, openInPrivateWindow) {
      if (openInPrivateWindow === "true") {
        browser.windows.create({
          incognito: true,
          url: URL
        });
      }
      else {
        browser.runtime.sendMessage({
          messageName: "query_eGPrefs",
          methodName: "getLoadURLInPref"
        }).then(aMessage => {
          this._openURLOn(URL, aMessage.response, true);
        });
      }
    }, startsNewGroup, nextAction);
}
LoadURLAction.prototype = Object.create(NumberedAction.prototype);
LoadURLAction.prototype.constructor = LoadURLAction;

function RunScriptAction(number, startsNewGroup, nextAction) {
  NumberedAction.call(this, "runScript", number, function(script) {
    return {
      runActionName: "runScript",
      runActionOptions: {
        script: script
      }
    };
  }, startsNewGroup, nextAction);
}
RunScriptAction.prototype = Object.create(NumberedAction.prototype);
RunScriptAction.prototype.constructor = RunScriptAction;

function ImageExistsDisableableAction(name, action, startsNewGroup, nextAction) {
  DisableableAction.call(this, name, action, function() {
    return eGContext.imageElementDoesntExist;
  }, startsNewGroup, nextAction);
}
ImageExistsDisableableAction.prototype = Object.create(DisableableAction.prototype);
ImageExistsDisableableAction.prototype.constructor = ImageExistsDisableableAction;

function DocumentContainsImagesDisableableAction(name, startsNewGroup, nextAction) {
  Action.call(this, name, function() {
    return {
      runActionName: "hideImages"
    };
  }, startsNewGroup, nextAction);
}
DocumentContainsImagesDisableableAction.prototype = Object.create(Action.prototype);
DocumentContainsImagesDisableableAction.prototype.constructor = DocumentContainsImagesDisableableAction;
DocumentContainsImagesDisableableAction.prototype.getActionStatus = function() {
  return {
    messageName: "setHideImagesActionStatus",
    status: undefined
  };
};

function CommandAction(name, startsNewGroup, nextAction) {
  Action.call(this, name, function() {
    return {
      runActionName: "commandAction",
      runActionOptions: {
        commandName: name
      }
    };
  }, startsNewGroup, nextAction);
}
CommandAction.prototype = Object.create(Action.prototype);
CommandAction.prototype.constructor = CommandAction;

function DisableableCommandAction(name, startsNewGroup, nextAction) {
  DisableableAction.call(this, name, function() {
    var window = Services.wm.getMostRecentWindow("navigator:browser");
    window.goDoCommand("cmd_" + name);
  }, function() {
    var window = Services.wm.getMostRecentWindow("navigator:browser");
    var controller = window.document.commandDispatcher
                                    .getControllerForCommand("cmd_" + name);
    return controller === null || !controller.isCommandEnabled("cmd_" + name);
  }, startsNewGroup, nextAction);
}
DisableableCommandAction.prototype = Object.create(DisableableAction.prototype);
DisableableCommandAction.prototype.constructor = DisableableCommandAction;


var eGActions = {
  empty : new EmptyAction(false, "showExtraMenu"),
  
  showExtraMenu : new ShowExtraMenuAction(true, "back"),
  
  back : new Action("back", function() {
    return this._sendPerformActionMessage();
  }, true, "backSite"),
  
  backSite : new Action("backSite", function() {}, false, "firstPage"),
  
  firstPage : new Action("firstPage", function() {}, false, "forward"),
  
  forward : new Action("forward", function() {
    return this._sendPerformActionMessage();
  }, false, "forwardSite"),
  
  forwardSite : new Action("forwardSite", function() {}, false, "lastPage"),
  
  lastPage : new Action("lastPage", function() {}, false, "reload"),
  
  reload : new Action("reload", function() {
    browser.tabs.reload({
      bypassCache: true
    });
  }, false, "homepage"),
  
  homepage : new Action("homepage", function() {
    var homepage = Services.prefs.getCharPref("browser.startup.homepage");
    var window = Services.wm.getMostRecentWindow("navigator:browser");
    window.gBrowser.loadTabs(homepage.split("|"), true, false);
  }, false, "pageTop"),
  
  pageTop : new DisableableAction("pageTop", function() {
    return this._sendPerformActionMessage();
  }, function() {
    return new Promise(resolve => {
      resolve(eGContext.targetWindowScrollY === 0 &&
              eGContext.topmostWindowScrollY === 0);
    });
  }, true, "pageBottom"),
  
  pageBottom : new DisableableAction("pageBottom", function() {
    return this._sendPerformActionMessage();
  }, function() {
    return new Promise(resolve => {
      resolve(
        eGContext.targetWindowScrollY === eGContext.targetWindowScrollMaxY &&
        eGContext.topmostWindowScrollY === eGContext.topmostWindowScrollMaxY
      );
    });
  }, false, "autoscrolling"),
  
  autoscrolling : new Action("autoscrolling", function() {
    return this._sendPerformActionMessage({
             useMousedownCoordinates: false
           });
  }, false, "zoomIn"),
  
  zoomIn : new Action("zoomIn", function() {
    if (eGContext.imageElementDoesntExist) {
      browser.tabs.getZoom().then(zoomFactor => {
        let newZoomFactor = this.increasingZoomLevels.find(element => {
          return element > zoomFactor;
        });
        if (newZoomFactor !== undefined) {
          browser.tabs.setZoom(newZoomFactor);
        }
      });
    }
    else {
      return this._sendPerformActionMessage();
    }
  }, false, "zoomOut"),
  
  zoomOut : new Action("zoomOut", function() {
    if (eGContext.imageElementDoesntExist) {
      browser.tabs.getZoom().then(zoomFactor => {
        let newZoomFactor = this.decreasingZoomLevels.find(element => {
          return element < zoomFactor;
        });
        if (newZoomFactor !== undefined) {
          browser.tabs.setZoom(newZoomFactor);
        }
      });
    }
    else {
      return this._sendPerformActionMessage();
    }
  }, false, "zoomReset"),
  
  zoomReset : new Action("zoomReset", function() {
    browser.tabs.setZoom(1);
  }, false, "toggleFullscreen"),
  
  toggleFullscreen : new Action("toggleFullscreen", function() {
    browser.windows.getCurrent().then(aWindow => {
      let newState = aWindow.state === "fullscreen" ? "normal" : "fullscreen";
      browser.windows.update(aWindow.id, {
        state: newState
      });
    });
  }, false, "toggleFindBar"),
  
  toggleFindBar : new Action("toggleFindBar", function() {
    var window = Services.wm.getMostRecentWindow("navigator:browser");
    if (window.gFindBar.hidden) {
      window.gFindBar.onFindCommand();
    }
    else {
      window.gFindBar.close();
    }
  }, false, "savePageAs"),
  
  savePageAs : new Action("savePageAs", function() {
    var window = Services.wm.getMostRecentWindow("navigator:browser");
    window.saveBrowser(window.gBrowser.selectedBrowser);
  }, false, "printPage"),
  
  printPage : new Action("printPage", function() {
    return this._sendPerformActionMessage();
  }, false, "viewPageSource"),
  
  viewPageSource : new Action("viewPageSource", function() {
    var window = Services.wm.getMostRecentWindow("navigator:browser");
    window.BrowserViewSource(window.gBrowser.selectedBrowser);
  }, false, "viewPageInfo"),
  
  viewPageInfo : new Action("viewPageInfo", function() {
    var window = Services.wm.getMostRecentWindow("navigator:browser");
    window.BrowserPageInfo();
  }, false, "newTab"),
  
  newTab : new Action("newTab", function() {
    browser.tabs.create({});
  }, true, "newBlankTab"),
  
  newBlankTab : new Action("newBlankTab", function() {
    browser.tabs.create({
      url: "about:blank"
    });
  }, false, "duplicateTab"),
  
  duplicateTab : new Action("duplicateTab", function() {
    this._performOnCurrentTab(function(currentTab) {
      browser.tabs.duplicate(currentTab.id);
    });
  }, false, "closeTab"),
  
  closeTab : new DisableableAction("closeTab", function() {
    this._performOnCurrentTab(function(currentTab) {
      browser.tabs.remove(currentTab.id);
    });
  }, function() {
    return this._performOnCurrentTab(function(currentTab) {
      return currentTab.pinned;
    });
  }, false, "closeOtherTabs"),
  
  closeOtherTabs : new DisableableAction("closeOtherTabs", function() {
    browser.tabs.query({
      active: false,
      pinned: false,
      currentWindow: true
    }).then(tabsToClose => {
      browser.tabs.remove(tabsToClose.map(tab => {
        return tab.id;
      }));
    });
  }, function() {
    return browser.tabs.query({
      active: false,
      pinned: false,
      currentWindow: true
    }).then(tabsToClose => {
      return tabsToClose.length === 0;
    });
  }, false, "undoCloseTab"),
  
  undoCloseTab : new DisableableAction("undoCloseTab", function() {
    browser.sessions.getRecentlyClosed().then(closedItems => {
      let mostRecentlyClosedTab = closedItems.find(closedItem => {
        return closedItem.tab !== undefined;
      });
      browser.sessions.restore(mostRecentlyClosedTab.tab.sessionId);
    });
  }, function() {
    return browser.sessions.getRecentlyClosed().then(closedItems => {
      let mostRecentlyClosedTab = closedItems.find(closedItem => {
        return closedItem.tab !== undefined;
      });
      return mostRecentlyClosedTab === undefined;
    });
  }, false, "prevTab"),
  
  prevTab : new OtherTabsExistDisableableAction("prevTab", function() {
    this._performOnCurrentTab(async function(currentTab) {
      let tabs = await browser.tabs.query({
        currentWindow: true
      });
      let [previousTab] = await browser.tabs.query({
        index: currentTab.index - 1 < 0 ? tabs.length - 1 :
                                          currentTab.index - 1,
        currentWindow: true
      });
      browser.tabs.update(previousTab.id, {
        active: true
      });
    });
  }, false, "nextTab"),
  
  nextTab : new OtherTabsExistDisableableAction("nextTab", function() {
    this._performOnCurrentTab(async function(currentTab) {
      let tabs = await browser.tabs.query({
        currentWindow: true
      });
      let [nextTab] = await browser.tabs.query({
        index: currentTab.index + 1 < tabs.length ? currentTab.index + 1 : 0,
        currentWindow: true
      });
      browser.tabs.update(nextTab.id, {
        active: true
      });
    });
  }, false, "pinUnpinTab"),
  
  pinUnpinTab : new Action("pinUnpinTab", function() {
    this._performOnCurrentTab(function(currentTab) {
      browser.tabs.update({
        pinned: !currentTab.pinned
      });
    });
  }, false, "newWindow"),
  
  newWindow : new Action("newWindow", function() {
    var window = Services.wm.getMostRecentWindow("navigator:browser");
    window.open("about:blank");
    if (Services.prefs.getIntPref("browser.startup.page") !== 0) {
      window = Services.wm.getMostRecentWindow("navigator:browser");
      let homepage = Services.prefs.getCharPref("browser.startup.homepage");
      window.gBrowser.loadTabs(homepage.split("|"), true, true);
    }
  }, true, "newBlankWindow"),
  
  newBlankWindow : new Action("newBlankWindow", function() {
    browser.windows.create({});
  }, false, "newPrivateWindow"),
  
  newPrivateWindow : new Action("newPrivateWindow", function() {
    browser.windows.create({
      incognito: true
    });
  }, false, "duplicateWindow"),
  
  duplicateWindow : new Action("duplicateWindow", async function() {
    let currentWindow = await browser.windows.getCurrent({
      populate: true
    });
    let newWindow = await browser.windows.create({});
    Promise.all(currentWindow.tabs.map(tab => {
      return browser.tabs.duplicate(tab.id).then(async duplicatedTab => {
        let wasPinned = duplicatedTab.pinned;
        let unpinnedTab = await browser.tabs.update(duplicatedTab.id, {
          pinned: false
        });
        browser.tabs.move(unpinnedTab.id, {
          windowId: newWindow.id,
          index: tab.index + 1
        }).then(movedTabs => {
          browser.tabs.update(movedTabs[0].id, {
            pinned: wasPinned
          });
        });
      });
    })).then(() => {
      browser.tabs.remove(newWindow.tabs[0].id);
    });
  }, false, "minimizeWindow"),
  
  minimizeWindow : new Action("minimizeWindow", function() {
    browser.windows.getCurrent().then(currentWindow => {
      browser.windows.update(currentWindow.id, {
        state: "minimized"
      });
    });
  }, false, "closeWindow"),
  
  closeWindow : new Action("closeWindow", function() {
    browser.windows.getCurrent().then(currentWindow => {
      browser.windows.remove(currentWindow.id);
    });
  }, false, "closeOtherWindows"),
  
  closeOtherWindows : new DisableableAction("closeOtherWindows", async function() {
    let currentWindow = await browser.windows.getCurrent();
    let openWindows = await browser.windows.getAll();
    openWindows.forEach(windowToClose => {
      if (windowToClose.id !== currentWindow.id) {
        browser.windows.remove(windowToClose.id);
      }
    });
  }, function() {
    return browser.windows.getAll().then(openWindows => {
      return openWindows.length === 1;
    });
  }, false, "undoCloseWindow"),
  
  undoCloseWindow : new DisableableAction("undoCloseWindow", function() {
    browser.sessions.getRecentlyClosed().then(closedItems => {
      let mostRecentlyClosedWindow = closedItems.find(closedItem => {
        return closedItem.window !== undefined;
      });
      browser.sessions.restore(mostRecentlyClosedWindow.window.sessionId);
    });
  }, function() {
    return browser.sessions.getRecentlyClosed().then(closedItems => {
      let mostRecentlyClosedWindow = closedItems.find(closedItem => {
        return closedItem.window !== undefined;
      });
      return mostRecentlyClosedWindow === undefined;
    });
  }, false, "up"),
  
  up : new CanGoUpDisableableAction("up", function() {
    this._performOnCurrentTab(function(currentTab) {
      let url = new URL(currentTab.url);
      let pathname = url.pathname;
      // removing any trailing "/" and the leading "/"
      pathname = pathname.replace(/\/$/, "").substring(1);
      let pathnameItems = pathname.split("/");
      pathnameItems.pop();
      browser.tabs.update({
        url: url.protocol + "//" + url.username +
             (url.password === "" ? "" : ":" + url.password) +
             (url.username === "" ? "" : "@") + url.hostname + "/" +
             pathnameItems.join("/") + (pathnameItems.length === 0 ? "" : "/")
      });
    });
  }, true, "root"),
  
  root : new CanGoUpDisableableAction("root", function() {
    this._performOnCurrentTab(function(currentTab) {
      let url = new URL(currentTab.url);
      browser.tabs.update({
        url: url.protocol + "//" + url.username +
             (url.password === "" ? "" : ":" + url.password) +
             (url.username === "" ? "" : "@") + url.hostname
      });
    });
  }, false, "showOnlyThisFrame"),
  
  showOnlyThisFrame : new Action("showOnlyThisFrame", function() {
    var window = Services.wm.getMostRecentWindow("navigator:browser");
    window.loadURI(eGContext.targetDocumentURL);
  }, false, "focusLocationBar"),
  
  focusLocationBar : new Action("focusLocationBar", function() {
    var window = Services.wm.getMostRecentWindow("navigator:browser");
    window.gURLBar.focus();
  }, false, "searchWeb"),
  
  searchWeb : new Action("searchWeb", function() {
    var window = Services.wm.getMostRecentWindow("navigator:browser");
    window.BrowserSearch.searchBar.value = eGContext.selection;
    window.BrowserSearch.webSearch();
  }, false, "quit"),
  
  quit : new Action("quit", function() {
    Services.startup.quit(Components.interfaces.nsIAppStartup.eForceQuit);
  }, false, "restart"),
  
  restart : new Action("restart", function() {
    Services.startup.quit(Components.interfaces.nsIAppStartup.eAttemptQuit |
                          Components.interfaces.nsIAppStartup.eRestart);
  }, false, "openLink"),
  
  openLink : new LinkExistsDisableableAction("openLink", function() {
    browser.runtime.sendMessage({
      messageName: "query_eGPrefs",
      methodName: "getOpenLinkPref"
    }).then(aMessage => {
      this._openURLOn(eGContext.anchorElementHREF, aMessage.response, false);
    });
  }, true, "openLinkInNewWindow"),
  
  openLinkInNewWindow : new LinkExistsDisableableAction("openLinkInNewWindow", function() {
    browser.windows.create({
      url: eGContext.anchorElementHREF
    });
  }, false, "openLinkInNewPrivateWindow"),
  
  openLinkInNewPrivateWindow : new LinkExistsDisableableAction("openLinkInNewPrivateWindow", function() {
    browser.windows.create({
      incognito: true,
      url: eGContext.anchorElementHREF
    });
  }, false, "copyLink"),
  
  copyLink : new LinkExistsDisableableAction("copyLink", function() {
    Components.classes["@mozilla.org/widget/clipboardhelper;1"]
              .getService(Components.interfaces.nsIClipboardHelper)
              .copyString(eGContext.anchorElementHREF);
  }, false, "saveLinkAs"),
  
  saveLinkAs : new LinkExistsDisableableAction("saveLinkAs", function() {
    this._saveContentFromLink(eGContext.anchorElementHREF,
                              Components.interfaces.nsIFilePicker.filterHTML);
  }, false, "dailyReadings"),
  
  dailyReadings : new DailyReadingsDisableableAction(true, "bookmarkThisPage"),
  
  bookmarkThisPage : new DisableableAction("bookmarkThisPage", function() {
    this._performOnCurrentTab(function(currentTab) {
      browser.bookmarks.create({
        title: currentTab.title,
        url: currentTab.url
      });
    });
  }, function() {
    return this._performOnCurrentTab(function(currentTab) {
      return browser.bookmarks.search({
        url: currentTab.url
      }).then(foundBookmarks => {
        return foundBookmarks.length > 0;
      });
    });
  }, false, "bookmarkThisLink"),
  
  bookmarkThisLink : new DisableableAction("bookmarkThisLink", function() {
    browser.bookmarks.create({
      title: eGContext.anchorElementText,
      url: eGContext.anchorElementHREF
    });
  }, function() {
    return eGContext.anchorElementExists ? browser.bookmarks.search({
                                             url: eGContext.anchorElementHREF
                                           }).then(foundBookmarks => {
                                             return foundBookmarks.length > 0;
                                           })
                                         : new Promise(resolve => {
                                             return resolve(true);
                                           });
  }, false, "bookmarkOpenTabs"),
  
  bookmarkOpenTabs : new Action("bookmarkOpenTabs", function() {
    browser.windows.getCurrent({
      populate: true
    }).then(currentWindow => {
      currentWindow.tabs.forEach(tab => {
        browser.bookmarks.create({
          title: tab.title,
          url: tab.url
        });
      });
    });
  }, false, "showBookmarks"),
  
  showBookmarks : new Action("showBookmarks", function() {
    var window = Services.wm.getMostRecentWindow("navigator:browser");
    window.PlacesCommandHook.showPlacesOrganizer("AllBookmarks");
  }, false, "toggleBookmarksSidebar"),
  
  toggleBookmarksSidebar : new Action("toggleBookmarksSidebar", function() {
    var window = Services.wm.getMostRecentWindow("navigator:browser");
    window.SidebarUI.toggle("viewBookmarksSidebar");
  }, false, "toggleBookmarksToolbar"),
  
  toggleBookmarksToolbar : new Action("toggleBookmarksToolbar", function() {
    var window = Services.wm.getMostRecentWindow("navigator:browser");
    var document = window.document;
    var tb = document.getElementById("PersonalToolbar");
    if (tb.hasAttribute("collapsed")) {
      tb.removeAttribute("collapsed");
    }
    else {
      tb.setAttribute("collapsed", true);
    }
    // make it persistent
    document.persist("PersonalToolbar", "collapsed");
  }, false, "showHistory"),
  
  showHistory : new Action("showHistory", function() {
    var window = Services.wm.getMostRecentWindow("navigator:browser");
    window.PlacesCommandHook.showPlacesOrganizer("History");
  }, false, "toggleHistorySidebar"),
  
  toggleHistorySidebar : new Action("toggleHistorySidebar", function() {
    var window = Services.wm.getMostRecentWindow("navigator:browser");
    window.SidebarUI.toggle("viewHistorySidebar");
  }, false, "showDownloads"),
  
  showDownloads : new Action("showDownloads", function() {
    var window = Services.wm.getMostRecentWindow("navigator:browser");
    window.PlacesCommandHook.showPlacesOrganizer("Downloads");
  }, false, "loadURL1"),
  
  loadURL1 : new LoadURLAction(1, true, "loadURL2"),
  
  loadURL2 : new LoadURLAction(2, false, "loadURL3"),
  
  loadURL3 : new LoadURLAction(3, false, "loadURL4"),
  
  loadURL4 : new LoadURLAction(4, false, "loadURL5"),
  
  loadURL5 : new LoadURLAction(5, false, "loadURL6"),
  
  loadURL6 : new LoadURLAction(6, false, "loadURL7"),
  
  loadURL7 : new LoadURLAction(7, false, "loadURL8"),
  
  loadURL8 : new LoadURLAction(8, false, "loadURL9"),
  
  loadURL9 : new LoadURLAction(9, false, "loadURL10"),
  
  loadURL10 : new LoadURLAction(10, false, "runScript1"),
  
  runScript1 : new RunScriptAction(1, true, "runScript2"),
  
  runScript2 : new RunScriptAction(2, false, "runScript3"),
  
  runScript3 : new RunScriptAction(3, false, "runScript4"),
  
  runScript4 : new RunScriptAction(4, false, "runScript5"),
  
  runScript5 : new RunScriptAction(5, false, "runScript6"),
  
  runScript6 : new RunScriptAction(6, false, "runScript7"),
  
  runScript7 : new RunScriptAction(7, false, "runScript8"),
  
  runScript8 : new RunScriptAction(8, false, "runScript9"),
  
  runScript9 : new RunScriptAction(9, false, "runScript10"),
  
  runScript10 : new RunScriptAction(10, false, "firefoxPreferences"),
  
  firefoxPreferences : new Action("firefoxPreferences", function() {
    eGUtils.showOrOpenTab("about:preferences", true);
  }, true, "addOns"),
  
  addOns : new Action("addOns", function() {
    eGUtils.showOrOpenTab("about:addons", true);
  }, false, "easyGesturesNPreferences"),
  
  easyGesturesNPreferences : new Action("easyGesturesNPreferences", function() {
    eGUtils.showOrOpenTab("/options/options.html", "", true);
  }, false, "copyImageLocation"),
  
  copyImageLocation : new ImageExistsDisableableAction("copyImageLocation",
    function() {
    Components.classes["@mozilla.org/widget/clipboardhelper;1"]
              .getService(Components.interfaces.nsIClipboardHelper)
              .copyString(eGContext.imageElementSRC);
  }, true, "copyImage"),
  
  copyImage : new ImageExistsDisableableAction("copyImage", function() {
    var window = Services.wm.getMostRecentWindow("navigator:browser");
    // window.document.popupNode = eGPieMenu.imageElement;
    window.goDoCommand("cmd_copyImageContents");
  }, false, "saveImageAs"),
  
  saveImageAs : new ImageExistsDisableableAction("saveImageAs", function() {
    this._saveContentFromLink(eGContext.imageElementSRC,
                              Components.interfaces.nsIFilePicker.filterImages);
  }, false, "hideImages"),
  
  hideImages : new DocumentContainsImagesDisableableAction("hideImages", false, "cut"),
  
  cut : new CommandAction("cut", true, "copy"),
  
  copy : new CommandAction("copy", false, "paste"),
  
  paste : new DisableableCommandAction("paste", false, "undo"),
  
  undo : new DisableableCommandAction("undo", false, "redo"),
  
  redo : new DisableableCommandAction("redo", false, "selectAll"),
  
  selectAll : new DisableableCommandAction("selectAll", false, null)
};
