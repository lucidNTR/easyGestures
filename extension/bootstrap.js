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


/* exported startup, shutdown, install, uninstall */
/* global Components, Services, eGPieMenu, eGContext, eGActions, AddonManager,
          ADDON_INSTALL, ADDON_ENABLE, eGPrefs, ADDON_UPGRADE, eGStrings,
          ADDON_UNINSTALL */

Components.utils.import("resource://gre/modules/AddonManager.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

var eGPrefsObserver = {
  register: function() {
    this._branch = Services.prefs.getBranch("extensions.easygestures.");
    this._branch.addObserver("activation.", this, false);
    this._branch.addObserver("behavior.", this, false);
    this._branch.addObserver("menus.", this, false);
    this._branch.addObserver("customizations.", this, false);
  },

  unregister: function() {
    this._branch.removeObserver("activation.", this);
    this._branch.removeObserver("behavior.", this);
    this._branch.removeObserver("menus.", this);
    this._branch.removeObserver("customizations.", this);
  },

  observe: function() {
    // removing existing easyGestures menus from open web pages
    eGPieMenu.removeFromAllPages();
    
    // rebulding the menu
    eGPieMenu.init();
  }
};

function eG_enableMenu() {
  Services.mm.loadFrameScript("chrome://easygestures/content/menu-frame.js", true);
  Services.mm.addMessageListener("easyGesturesN@ngdeleito.eu:performOpenMenuChecks", eG_performOpenMenuChecks);
  Services.mm.addMessageListener("easyGesturesN@ngdeleito.eu:handleMousedown", eG_handleMousedown);
  Services.mm.addMessageListener("easyGesturesN@ngdeleito.eu:handleMouseup", eG_handleMouseup);
  Services.mm.addMessageListener("easyGesturesN@ngdeleito.eu:handleKeydown", eG_handleKeydown);
  Services.mm.addMessageListener("easyGesturesN@ngdeleito.eu:handleContextmenu", eG_handleContextmenu);
  Services.mm.addMessageListener("easyGesturesN@ngdeleito.eu:handleMousemove", eG_handleMousemove);
  Services.mm.addMessageListener("easyGesturesN@ngdeleito.eu:retrieveAndAddFavicon", eG_retrieveAndAddFavicon);
}

function eG_disableMenu() {
  Services.mm.removeDelayedFrameScript("chrome://easygestures/content/menu-frame.js");
  Services.mm.broadcastAsyncMessage("easyGesturesN@ngdeleito.eu:removeListeners");
  Services.mm.removeMessageListener("easyGesturesN@ngdeleito.eu:performOpenMenuChecks", eG_performOpenMenuChecks);
  Services.mm.removeMessageListener("easyGesturesN@ngdeleito.eu:handleMousedown", eG_handleMousedown);
  Services.mm.removeMessageListener("easyGesturesN@ngdeleito.eu:handleMouseup", eG_handleMouseup);
  Services.mm.removeMessageListener("easyGesturesN@ngdeleito.eu:handleKeydown", eG_handleKeydown);
  Services.mm.removeMessageListener("easyGesturesN@ngdeleito.eu:handleContextmenu", eG_handleContextmenu);
  Services.mm.removeMessageListener("easyGesturesN@ngdeleito.eu:handleMousemove", eG_handleMousemove);
  Services.mm.removeMessageListener("easyGesturesN@ngdeleito.eu:retrieveAndAddFavicon", eG_retrieveAndAddFavicon);
}

function eG_performOpenMenuChecks(aMessage) {
  const PREVENT_DEFAULT_AND_OPEN_MENU = 0;
  const PREVENT_DEFAULT_AND_RETURN = 1;
  const LET_DEFAULT_AND_RETURN = 2;
  var window = Services.wm.getMostRecentWindow("navigator:browser");
  
  // clear automatic delayed autoscrolling
  window.clearTimeout(eGContext.autoscrollingTrigger);
  
  // check whether pie menu should change layout or hide (later)
  if (eGPieMenu.isShown()) {
    if (eGPieMenu.canLayoutBeSwitched(aMessage.data.button)) {
      eGPieMenu.switchLayout();
    }
    return PREVENT_DEFAULT_AND_RETURN;
  }
  
  // check if menu should not be displayed
  if (!eGPieMenu.canBeOpened(aMessage.data.button, aMessage.data.shiftKey,
                             aMessage.data.ctrlKey, aMessage.data.altKey)) {
    return LET_DEFAULT_AND_RETURN;
  }
  
  return PREVENT_DEFAULT_AND_OPEN_MENU;
}

function eG_handleMousedown(aMessage) {
  eGContext.contextualMenus = aMessage.data.contextualMenus;
  eGContext.selection = aMessage.data.selection;
  eGContext.anchorElementExists = aMessage.data.anchorElementExists;
  eGContext.anchorElementHREF = aMessage.data.anchorElementHREF;
  eGContext.anchorElementText = aMessage.data.anchorElementText;
  eGContext.imageElementDoesntExist = aMessage.data.imageElementDoesntExist;
  eGContext.imageElementSRC = aMessage.data.imageElementSRC;
  eGPieMenu.centerX = aMessage.data.centerX;
  eGPieMenu.centerY = aMessage.data.centerY;
  eGContext.targetDocumentURL = aMessage.data.targetDocumentURL;
  eGContext.targetWindowScrollY = aMessage.data.targetWindowScrollY;
  eGContext.targetWindowScrollMaxY = aMessage.data.targetWindowScrollMaxY;
  eGContext.topmostWindowScrollY = aMessage.data.topmostWindowScrollY;
  eGContext.topmostWindowScrollMaxY = aMessage.data.topmostWindowScrollMaxY;
  
  if (eGContext.contextualMenus.length !== 0 &&
      eGPieMenu.canContextualMenuBeOpened(aMessage.data.ctrlKey, aMessage.data.altKey)) {
    eGPieMenu.show(eGContext.contextualMenus[0]);
  }
  else {
    eGPieMenu.show("main");
  }
  
  // give focus to browser (blur any outside-browser selected object so that it won't respond to keypressed event)
  var window = Services.wm.getMostRecentWindow("navigator:browser");
  window.gBrowser.focus();
  
  if (eGPieMenu.autoscrollingOn) {
    eGContext.autoscrollingTrigger = window.setTimeout(function() {
      eGActions.autoscrolling.run(eGPieMenu);
    }, eGPieMenu.autoscrollingDelay);
  }
}

function eG_handleMouseup(aMessage) {
  var preventDefaultUponReturn = false;
  var window = Services.wm.getMostRecentWindow("navigator:browser");
  
  if (eGPieMenu.isJustOpened()) {
    eGPieMenu.setOpen();
    if (aMessage.data.linkSignIsVisible) {
      window.clearTimeout(eGContext.autoscrollingTrigger);
      eGPieMenu.openLinkThroughPieMenuCenter(aMessage.data.button);
    }
  }
  else if (eGPieMenu.isJustOpenedAndMouseMoved()) {
    if (eGPieMenu.sector !== -1) {
      eGPieMenu.runAction();
    }
    else {
      eGPieMenu.setOpen();
      preventDefaultUponReturn = true;
    }
  }
  else if (eGPieMenu.isShown()) {
    if (aMessage.data.button === eGPieMenu.showAltButton) {
      preventDefaultUponReturn = true;
    }
    else {
      if (eGPieMenu.sector !== -1) {
        eGPieMenu.runAction();
      }
      else {
        eGPieMenu.close();
      }
    }
  }
  
  return preventDefaultUponReturn;
}

function eG_handleKeydown(aMessage) {
  var window = Services.wm.getMostRecentWindow("navigator:browser");
  
  // clear automatic delayed autoscrolling
  window.clearTimeout(eGContext.autoscrollingTrigger);
  
  if (eGPieMenu.isShown()) {
    if (aMessage.data.altKey) {
      eGPieMenu.switchLayout();
    }
    else if (aMessage.data.escKey) {
      eGPieMenu.close();
    }
  }
}

function eG_handleContextmenu(aMessage) {
  return eGPieMenu.canContextmenuBeOpened(aMessage.data.shiftKey,
                                          aMessage.data.ctrlKey,
                                          aMessage.data.altKey);
}

function eG_handleMousemove(aMessage) {
  var window = Services.wm.getMostRecentWindow("navigator:browser");
  
  // clear automatic delayed autoscrolling
  window.clearTimeout(eGContext.autoscrollingTrigger);
  
  return eGPieMenu.handleMousemove(aMessage.data);
}

function eG_retrieveAndAddFavicon(aMessage) {
  var aURL = aMessage.data.aURL;
  if (aURL === "") {
    return ;
  }
  
  if (aURL.match(/\:\/\//i) === null) {
    aURL = "http://" + aURL;
  }
  
  var faviconService = Components
                         .classes["@mozilla.org/browser/favicon-service;1"]
                         .getService(Components.interfaces.mozIAsyncFavicons);
  faviconService.getFaviconURLForPage(Services.io.newURI(aURL, null, null), function(aURI) {
    var window = Services.wm.getMostRecentWindow("navigator:browser");
    var browserMM = window.gBrowser.selectedBrowser.messageManager;
    browserMM.sendAsyncMessage("easyGesturesN@ngdeleito.eu:addFavicon", {
      anActionNodeID: aMessage.data.anActionNodeID,
      aURL: aURI !== null ? aURI.spec : ""
    });
  });
}

function startup(data, reason) {
  Components.utils.import("chrome://easygestures/content/eGPrefs.jsm");
  Components.utils.import("chrome://easygestures/content/eGStrings.jsm");
  Components.utils.import("chrome://easygestures/content/eGPieMenu.jsm");
  Components.utils.import("chrome://easygestures/content/eGActions.jsm");
  Components.utils.import("chrome://easygestures/content/eGContext.jsm");
  
  AddonManager.getAddonByID(data.id, function(addon) {
    // installing or upgrading preferences
    var count = {};
    Services.prefs.getChildList("extensions.easygestures.", count);
    if (reason === ADDON_INSTALL ||
        (reason === ADDON_ENABLE && count.value === 0)) {
      // when installing an extension by copying it to the extensions folder
      // reason == ADDON_ENABLE, hence the test to see if there are already
      // preferences in the easygestures preferences branch
      eGPrefs.setDefaultSettings();
      eGPrefs.initializeStats();
    }
    else if (reason === ADDON_UPGRADE) {
      if (Services.vc.compare(data.oldVersion, "4.5") < 0) {
        eGPrefs.updateToV4_5();
      }
      if (Services.vc.compare(data.oldVersion, "4.6") < 0) {
        eGPrefs.updateToV4_6();
      }
      if (Services.vc.compare(data.oldVersion, "4.7") < 0) {
        eGPrefs.updateToV4_7();
      }
      if (Services.vc.compare(data.oldVersion, "4.8") < 0) {
        eGPrefs.updateToV4_8();
      }
      if (Services.vc.compare(data.oldVersion, "4.10") < 0) {
        eGPrefs.updateToV4_10();
      }
      if (Services.vc.compare(data.oldVersion, "4.11") < 0) {
        eGPrefs.updateToV4_11();
      }
      if (Services.vc.compare(data.oldVersion, "4.12") < 0) {
        eGPrefs.updateToV4_12();
      }
      if (Services.vc.compare(data.oldVersion, "4.13") < 0) {
        eGPrefs.updateToV4_13();
      }
    }
    
    // getting access to localization strings
    eGStrings.init(addon);
    
    // start listening to changes in preferences that could require rebuilding
    // the menus
    eGPrefsObserver.register();
    
    // creating menu
    eGPieMenu.init();
    
    // registering style sheet
    var sss = Components.classes["@mozilla.org/content/style-sheet-service;1"]
                        .getService(Components.interfaces.nsIStyleSheetService);
    var uri = Services.io.newURI("chrome://easygestures/skin/actions.css", null, null);
    if (!sss.sheetRegistered(uri, sss.AUTHOR_SHEET)) {
      sss.loadAndRegisterSheet(uri, sss.AUTHOR_SHEET);
    }
    
    eG_enableMenu();
    
    // displaying startup tips
    if (eGPrefs.areStartupTipsOn()) {
      let window = Services.wm.getMostRecentWindow("navigator:browser");
      if (window.document.readyState === "complete") {
        window.openDialog("chrome://easygestures/content/tips.xul", "",
                          "chrome,centerscreen,resizable");
      }
      else {
        window.addEventListener("load", function displayTipsAtStartup() {
          window.removeEventListener("load", displayTipsAtStartup, false);
          window.openDialog("chrome://easygestures/content/tips.xul", "",
                            "chrome,centerscreen,resizable");
        }, false);
      }
    }
  });
}

function shutdown() {
  // flushing because a string bundle was created
  Services.strings.flushBundles();
  
  // stop listening to changes in preferences
  eGPrefsObserver.unregister();
  
  // removing existing easyGestures menus from open web pages
  eGPieMenu.removeFromAllPages();
  
  // unregistering style sheet
  var sss = Components.classes["@mozilla.org/content/style-sheet-service;1"]
                      .getService(Components.interfaces.nsIStyleSheetService);
  var uri = Services.io.newURI("chrome://easygestures/skin/actions.css", null, null);
  if (sss.sheetRegistered(uri, sss.AUTHOR_SHEET)) {
    sss.unregisterSheet(uri, sss.AUTHOR_SHEET);
  }
  
  eG_disableMenu();
  
  Components.utils.unload("chrome://easygestures/content/eGContext.jsm");
  Components.utils.unload("chrome://easygestures/content/eGActions.jsm");
  Components.utils.unload("chrome://easygestures/content/eGPieMenu.jsm");
  Components.utils.unload("chrome://easygestures/content/eGStrings.jsm");
  Components.utils.unload("chrome://easygestures/content/eGPrefs.jsm");
}

function install() {
}

function uninstall(data, reason) {
  if (reason === ADDON_UNINSTALL) {
    var prefs = Services.prefs.getBranch("extensions.easygestures.");
    prefs.deleteBranch("");
  }
}
