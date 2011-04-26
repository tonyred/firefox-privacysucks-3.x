/***************************************************************************
Name: CookieSafe
Description: Control cookie permissions.
Author: Ron Beckman
Homepage: http://addons.mozilla.org

Copyright (C) 2007  Ron Beckman

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 2
of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to:

Free Software Foundation, Inc.
51 Franklin Street
Fifth Floor
Boston, MA  02110-1301
USA
***************************************************************************/


var csCookieObserver = {

	init: function() {
		var os = this.getObserver();
		os.addObserver(this, 'quit-application', false);
		os.addObserver(this, 'cookie-changed', false);
		os.addObserver(this, 'cookie-rejected', false);
	},

	uninit: function() {
		var os = this.getObserver();
		os.removeObserver(this, 'quit-application');
		os.removeObserver(this, 'cookie-changed');
		os.removeObserver(this, 'cookie-rejected');
	},

	QueryInterface : function(aIID) {
		if (aIID.equals(Components.interfaces.nsISupports) ||
		    aIID.equals(Components.interfaces.nsIObserver))
			return this;
		throw Components.results.NS_NOINTERFACE;
	},

	getObserver: function() {
		return Components.classes["@mozilla.org/observer-service;1"].
		getService(Components.interfaces.nsIObserverService);
	},

	getCS: function() {
		return Components.classes['@mozilla.org/CookieSafe;1'].
		createInstance(Components.interfaces.nsICookieSafe);
	},

	getCSLast10Hosts: function() {
		return Components.classes['@mozilla.org/CSLast10Hosts;1'].
		getService(Components.interfaces.nsICSLast10Hosts);
	},

	getPrefs: function() {
		return Components.classes["@mozilla.org/preferences-service;1"].
		getService(Components.interfaces.nsIPrefService).
		getBranch("cookiesafe.");
	},

	getConsole: function() {
		return Components.classes["@mozilla.org/consoleservice;1"].
		getService(Components.interfaces.nsIConsoleService);
	},

	getStrBundle: function() {
		return Components.classes['@mozilla.org/intl/stringbundle;1'].
		getService(Components.interfaces.nsIStringBundleService).
		createBundle('chrome://cookiesafe/locale/cookiesafe.properties');
	},

	observe: function(aSubject, aTopic, aData) {
		if (aTopic == 'app-startup') {
			//register cookie observers for last 10 hosts and cookie logging
			this.init();
		}

		if (aTopic == 'quit-application') {
			//unregister observer for cookie notifications
			this.uninit();
		}

		if (aTopic != 'cookie-changed' &&
		    aTopic != 'cookie-rejected') return false;

		var cs = this.getCS();
		var lastten = this.getCSLast10Hosts();
		var prefs = this.getPrefs();
		var logChg = prefs.getBoolPref('logChangedNotifications');
		var logBlk = prefs.getBoolPref('logBlockedNotifications');

		if (aSubject) {
			if (aTopic=='cookie-rejected') {
				aSubject.QueryInterface(Components.interfaces.nsIURI);
			}

			if (aSubject instanceof Components.interfaces.nsIURI ||
			    aSubject instanceof Components.interfaces.nsICookie) {
				var host = (aSubject.host) ? aSubject.host : 'scheme:file';
				var base = cs.removeSub(host);
				lastten.addLastTenHosts(base);
			}
		}

		if ((logChg && aTopic=='cookie-changed') ||
		    (logBlk && aTopic=='cookie-rejected')) {
			this.logCookie(aSubject,aData,host);
		}
		return false;
	},

	logCookie: function(aSubject,aData,host) {
		var bdl = this.getStrBundle();

		//create title
		var title;
		if (!aData) {
			title = bdl.GetStringFromName('cookiesafe.lCookieBlocked');
		} else if (aData=='added') {
			title = bdl.GetStringFromName('cookiesafe.lCookieAdded');
		} else if (aData=='changed') {
			title = bdl.GetStringFromName('cookiesafe.lCookieChanged');
		} else if (aData=='deleted') {
			title = bdl.GetStringFromName('cookiesafe.lCookieDeleted');
		} else if (aData=='cleared') {
			title = bdl.GetStringFromName('cookiesafe.lCookiesCleared');
		}

		//create message
		var msg = title;
		if (aData=='added' || aData=='changed' || aData=='deleted') {
			var exp = new Date();
			if (aSubject.expires) {
				exp.setTime(aSubject.expires * 1000);
			} else {
				exp = bdl.GetStringFromName('cookiesafe.lSession');
			}
			msg += '\n'+bdl.GetStringFromName('cookiesafe.lHost')+': '+host+'\n'+
				    bdl.GetStringFromName('cookiesafe.lName')+': '+aSubject.name+'\n'+
				    bdl.GetStringFromName('cookiesafe.lValue')+': '+aSubject.value+'\n'+
				    bdl.GetStringFromName('cookiesafe.lExpires')+': '+exp;
		} else if (!aData) {
			msg += '\n'+bdl.GetStringFromName('cookiesafe.lHost')+': '+host+'\n'+
				    bdl.GetStringFromName('cookiesafe.lUrl')+': '+aSubject.spec;
		}

		var csl = this.getConsole();
		csl.logStringMessage(msg);
	}
};

var csCookieModule = {

	registerSelf: function (compMgr, fileSpec, location, type) {
		var compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
		compMgr.registerFactoryLocation(this.myCID,
		this.myName,
		this.myProgID,
		fileSpec,
		location,
		type);

		var catMgr = Components.classes["@mozilla.org/categorymanager;1"].
		getService(Components.interfaces.nsICategoryManager);
		catMgr.addCategoryEntry("app-startup", this.myName, this.myProgID, true, true);
	},

	getClassObject: function (compMgr, cid, iid) {
		return this.csCookieFactory;
	},

	myCID: Components.ID("{3095c95c-991e-46f6-8b2e-fdb2dac138cb}"),

	myProgID: "@mozilla.org/csCookieObserver;1",

	myName: "CookieSafe Cookie Observer",

	csCookieFactory: {
		QueryInterface: function (aIID) {
			if (!aIID.equals(Components.interfaces.nsISupports) &&
			    !aIID.equals(Components.interfaces.nsIFactory))
				throw Components.results.NS_ERROR_NO_INTERFACE;
			return this;
		},

		createInstance: function (outer, iid) {
			return csCookieObserver;
		}
	},

	canUnload: function(compMgr) {
		return true;
	}
};

function NSGetModule(compMgr, fileSpec) {
	return csCookieModule;
}
