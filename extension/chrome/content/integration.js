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

The Original Code is RadialContext.

The Initial Developer of the Original Code is Jens Tinz.
Portions created by the Initial Developer are Copyright (C) 2002
the Initial Developer. All Rights Reserved.

Contributor(s):
  Ons Besbes.
  ngdeleito
  
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


/* global eGActions, eGm, eGPrefs */

var eGc = {
  keyPressed: 0, // used to control display of pie menu
  
  targetDocumentURL: null,
  targetWindowScrollY: null,
  targetWindowScrollMaxY: null,
  topmostWindowScrollY: null,
  topmostWindowScrollMaxY: null,
  topmostDocumentURL: null,
  topmostDocumentTitle: null,
  
  loading: false // used for reload/stop action
};

function eG_enableMenu() {
  Services.mm.loadFrameScript("chrome://easygestures/content/menu-frame.js", true);
  Services.mm.addMessageListener("easyGesturesN@ngdeleito.eu:performOpenMenuChecks", eG_performOpenMenuChecks);
  Services.mm.addMessageListener("easyGesturesN@ngdeleito.eu:handleMousedown", eG_handleMousedown);
  Services.mm.addMessageListener("easyGesturesN@ngdeleito.eu:handleMouseup", eG_handleMouseup);
  Services.mm.addMessageListener("easyGesturesN@ngdeleito.eu:handleMousemove", eG_handleMousemove);
  Services.mm.addMessageListener("easyGesturesN@ngdeleito.eu:handleKeydown", eG_handleKeydown);
  Services.mm.addMessageListener("easyGesturesN@ngdeleito.eu:handleKeyup", eG_handleKeyup);
  Services.mm.addMessageListener("easyGesturesN@ngdeleito.eu:handleContextmenu", eG_handleContextmenu);
}

function eG_disableMenu() {
  Services.mm.broadcastAsyncMessage("easyGesturesN@ngdeleito.eu:removeMessageListeners");
  Services.mm.removeMessageListener("easyGesturesN@ngdeleito.eu:performOpenMenuChecks", eG_performOpenMenuChecks);
  Services.mm.removeMessageListener("easyGesturesN@ngdeleito.eu:handleMousedown", eG_handleMousedown);
  Services.mm.removeMessageListener("easyGesturesN@ngdeleito.eu:handleMouseup", eG_handleMouseup);
  Services.mm.removeMessageListener("easyGesturesN@ngdeleito.eu:handleMousemove", eG_handleMousemove);
  Services.mm.removeMessageListener("easyGesturesN@ngdeleito.eu:handleKeydown", eG_handleKeydown);
  Services.mm.removeMessageListener("easyGesturesN@ngdeleito.eu:handleKeyup", eG_handleKeyup);
  Services.mm.removeMessageListener("easyGesturesN@ngdeleito.eu:handleContextmenu", eG_handleContextmenu);
}

function eG_countClicks(anEvent) {
  eGPrefs.incrementStatsClicksPref();
  
  // disabling counting clicks inside window if menu is displayed
  if (eGm.isShown()) {
    let window = anEvent.currentTarget;
    window.removeEventListener("mousedown", eG_countClicks, false);
  }
}

function eG_handleKeyup() {
  eGc.keyPressed = 0;
}

function eG_handleKeydown(aMessage) {
  var window = Services.wm.getMostRecentWindow("navigator:browser");
  
  // clear automatic delayed autoscrolling
  window.clearTimeout(eGm.autoscrollingTrigger);
  
  eGc.keyPressed = aMessage.data.keyPressed;
  
  if (eGm.isShown()) {
    if (eGc.keyPressed === 18) { // Alt key
      eGm.switchLayout();
    }
    else if (eGc.keyPressed === 27) { // ESC key
      eGm.close();
      return true;
    }
  }
  return false;
}

function eG_handleMouseup(aMessage) {
  var window = Services.wm.getMostRecentWindow("navigator:browser");
  
  if (eGm.isHidden()) {
    let browserMM = window.gBrowser.selectedBrowser.messageManager;
    browserMM.sendAsyncMessage("easyGesturesN@ngdeleito.eu:removeMousemoveListener");
  }
  else if (eGm.isJustOpened()) {
    eGm.setOpen();
    eGm.openLinkThroughPieMenuCenter(aMessage.data.linkSignIsVisible,
                                     aMessage.data.button);
  }
  else if (eGm.isJustOpenedAndMouseMoved()) {
    if (eGm.sector !== -1) {
      eGm.runAction();
    }
    else {
      eGm.setOpen();
      return 1;
    }
  }
  else {
    if (aMessage.data.button === eGm.showAltButton) {
      return 1;
    }
    else {
      if (eGm.sector !== -1) {
        eGm.runAction();
      }
      else {
        eGm.close();
      }
    }
  }
}

function eG_handleMousemove(aMessage) {
  var window = Services.wm.getMostRecentWindow("navigator:browser");
  
  // clear automatic delayed autoscrolling
  window.clearTimeout(eGm.autoscrollingTrigger);
  
  return eGm.handleMousemove(aMessage.data);
}

function eG_performOpenMenuChecks(aMessage) {
  const PREVENT_DEFAULT_AND_OPEN_MENU = 0;
  const PREVENT_DEFAULT_AND_RETURN = 1;
  const LET_DEFAULT_AND_RETURN = 2;
  var window = Services.wm.getMostRecentWindow("navigator:browser");
  
  // clear automatic delayed autoscrolling
  window.clearTimeout(eGm.autoscrollingTrigger);
  
  // check whether pie menu should change layout or hide (later)
  if (eGm.isShown()) {
    if (eGm.canLayoutBeSwitched(aMessage.data.button)) {
      eGm.switchLayout();
    }
    return PREVENT_DEFAULT_AND_RETURN;
  }
  
  // check if menu should not be displayed
  if (!eGm.canBeOpened(aMessage.data.button, aMessage.data.shiftKey, aMessage.data.ctrlKey)) {
    return LET_DEFAULT_AND_RETURN;
  }
  
  return PREVENT_DEFAULT_AND_OPEN_MENU;
}

function eG_handleMousedown(aMessage) {
  eGm.contextualMenus = aMessage.data.contextualMenus;
  eGm.selection = aMessage.data.selection;
  eGm.anchorElementExists = aMessage.data.anchorElementExists;
  eGm.anchorElementHREF = aMessage.data.anchorElementHREF;
  eGm.imageElementDoesntExist = aMessage.data.imageElementDoesntExist;
  eGm.imageElementStyleWidth = aMessage.data.imageElementStyleWidth;
  eGm.imageElementWidth = aMessage.data.imageElementWidth;
  eGm.imageElementStyleHeight = aMessage.data.imageElementStyleHeight;
  eGm.imageElementHeight = aMessage.data.imageElementHeight;
  eGm.imageElementSRC = aMessage.data.imageElementSRC;
  eGm.centerX = aMessage.data.centerX;
  eGm.centerY = aMessage.data.centerY;
  eGc.targetDocumentURL = aMessage.data.targetDocumentURL;
  eGc.targetWindowScrollY = aMessage.data.targetWindowScrollY;
  eGc.targetWindowScrollMaxY = aMessage.data.targetWindowScrollMaxY;
  eGc.topmostWindowScrollY = aMessage.data.topmostWindowScrollY;
  eGc.topmostWindowScrollMaxY = aMessage.data.topmostWindowScrollMaxY;
  eGc.topmostDocumentURL = aMessage.data.topmostDocumentURL;
  eGc.topmostDocumentTitle = aMessage.data.topmostDocumentTitle;
  
  
  var window = Services.wm.getMostRecentWindow("navigator:browser");
  var browserMM = window.gBrowser.selectedBrowser.messageManager;
  browserMM.sendAsyncMessage("easyGesturesN@ngdeleito.eu:addMousemoveListener");
  
  if (eGm.contextualMenus.length !== 0 &&
      eGm.canContextualMenuBeOpened(eGc.keyPressed)) {
    eGm.show(eGm.contextualMenus[0]);
  }
  else {
    eGm.show("main");
  }
  
  // give focus to browser (blur any outside-browser selected object so that it won't respond to keypressed event)
  window.gBrowser.focus();
  
  if (eGm.autoscrollingOn) {
    eGm.autoscrollingTrigger = window.setTimeout(function() {
      eGm.close();
      eGActions.autoscrolling.run();
    }, eGm.autoscrollingDelay);
  }
}

function eG_handleContextmenu(aMessage) {
  return eGm.showButton === 2 /* right click */ &&
         ((eGm.showKey === 0 && eGc.keyPressed === 0) ||
          (eGm.showKey === 0 && eGc.keyPressed === eGm.contextKey) ||
          (eGm.showKey === 16 && aMessage.data.shiftKey) ||
          (eGm.showKey === 17 && aMessage.data.ctrlKey));
}
