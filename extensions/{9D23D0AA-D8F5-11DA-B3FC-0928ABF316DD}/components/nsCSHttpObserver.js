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


var csHttpObserver = {

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

	getAppInfo: function() {
		return Components.classes['@mozilla.org/xre/app-info;1'].
		createInstance(Components.interfaces.nsIXULAppInfo);
	},

	getCS: function() {
		return Components.classes['@mozilla.org/CookieSafe;1'].
		createInstance(Components.interfaces.nsICookieSafe);
	},

	getPrefs: function() {
		return Components.classes["@mozilla.org/preferences-service;1"].
		getService(Components.interfaces.nsIPrefService).
		getBranch("cookiesafe.");
	},

	getGlobalPrefs: function() {
		return Components.classes["@mozilla.org/preferences-service;1"].
		getService(Components.interfaces.nsIPrefService).
		getBranch("network.cookie.");
	},

	getCookieManager2: function() {
		return Components.classes["@mozilla.org/cookiemanager;1"].
		getService(Components.interfaces.nsICookieManager2);
	},

	getCookieService: function() {
		return Components.classes["@mozilla.org/cookieService;1"].
		getService(Components.interfaces.nsICookieService);
	},

	testPermission: function(host) {
		var url = (host=='scheme:file') ? 'file:///cookiesafe' : 'http://'+host;
		var uri = this.getURI(url);
		var mngr = this.getPermManager();
		var action = mngr.testPermission(uri,'cookie');
		return action;
	},

	getURI: function(url) {
		return Components.classes["@mozilla.org/network/io-service;1"].
		getService(Components.interfaces.nsIIOService).
		newURI(url,null,null);
	},

	getPermManager: function() {
		//make sure the browser includes the nsipermissionmanager interface
		if ('nsIPermissionManager' in Components.interfaces) {
			return Components.classes["@mozilla.org/permissionmanager;1"].
			getService(Components.interfaces.nsIPermissionManager);
		} else {
			return Components.classes["@mozilla.org/CSPermManager;1"].
			getService(Components.interfaces.nsICSPermManager);
		}
	},

	init: function() {
		var os = this.getObserver();
		os.addObserver(this, 'quit-application', false);
		os.addObserver(this, 'http-on-modify-request', false);
		os.addObserver(this, 'http-on-examine-response', false);
		os.addObserver(this, 'http-on-examine-merged-response', false);
	},

	uninit: function() {
		var os = this.getObserver();
		os.removeObserver(this, 'quit-application');
		os.removeObserver(this, 'http-on-modify-request');
		os.removeObserver(this, 'http-on-examine-response');
		os.removeObserver(this, 'http-on-examine-merged-response');
	},

	observe: function(aSubject, aTopic, aData) {
		if (aTopic == 'app-startup') {
			//only init the http observer for Thunderbird
			var brows = this.getAppInfo();
			if (brows.name=='Thunderbird') this.init();
		}

		if (aTopic == 'quit-application') {
			//only uninit the http observer for Thunderbird
			var brows = this.getAppInfo();
			if (brows.name=='Thunderbird') this.uninit();

		}

		if (aTopic != 'http-on-modify-request' &&
		    aTopic != 'http-on-examine-response' &&
		    aTopic != 'http-on-examine-merged-response') return false;

		try {
			var httpChannel = aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);
			var channelInternal = aSubject.QueryInterface(Components.interfaces.nsIHttpChannelInternal);
			var channel = aSubject.QueryInterface(Components.interfaces.nsIChannel);
		} catch(e) {
			return false;
		}

		/*Thunderbird will automatically strip cookie headers from channels using the https
		protocol.  There is presently NO solution for https uris so we can just return
		instead of trying to process the https cookie headers which will stripped anyway.*/

		if (channel.URI.scheme.substr(0,4) != 'http') return false;

		//make sure user wants CS to process cookies in TB, if more than one http
		//observer is active at a time there could be conflicts with other extensions
		var prefs = this.getPrefs();
		if (!prefs.getBoolPref('processTBCookies')) return false;

		//test whether uri host has permission to set or receive cookies
		var action = this.testPermission(channel.URI.host);

		var gPrefs = this.getGlobalPrefs();
		var behavior = gPrefs.getIntPref('cookieBehavior');

		if (aTopic=='http-on-modify-request') {
			try {
				var reqHead = httpChannel.getRequestHeader("Cookie");
			} catch(e) {
				return false;
			}

			if (!reqHead) {
				if (action==1 || action==8 || (behavior==0 && !action)) {
					var cksrv = this.getCookieService();
					var ckstr = cksrv.getCookieString(channel.URI,null);
					httpChannel.setRequestHeader("Cookie",ckstr,false);
				}
			}
		}

		if (aTopic=='http-on-examine-response' || aTopic=='http-on-examine-merged-response') {
			try {
				var resHead = httpChannel.getResponseHeader("Set-Cookie");
			} catch(e) {
				return false;
			}

			if (resHead) {
				if (action==1 || action==8 || (behavior==0 && !action)) {
					var ck,exp;
					var cs = this.getCS();
					var mngr = this.getCookieManager2();
					var dt = new Date();
					var time = dt.getTime();
					var cookies = resHead.split('\n');
					for (var i=0; i<cookies.length; ++i) {
						ck = cs.formatCookieString(cookies[i],channel.URI);
						exp = (action==8) ? 0 : ck.expires; //ck.expires is readonly so we use a new variable here
						if ('cookieExists' in mngr) {
							mngr.add(ck.host,ck.path,ck.name,ck.value,ck.isSecure,true,
								(!exp) ? true : false,
								(!exp) ? parseInt(time / 1000) + 86400 : exp);
						} else {
							mngr.add(ck.host,ck.path,ck.name,ck.value,ck.isSecure,
								(!exp) ? true : false,
								(!exp) ? parseInt(time / 1000) + 86400 : exp);
						}
					}
					httpChannel.setResponseHeader("Set-Cookie","",false);
				}
			}
		}
		return false;
	}
};

var csHttpModule = {

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
		return this.csHttpFactory;
	},

	myCID: Components.ID("{559f36d9-ef06-42ae-8378-846d452cd244}"),

	myProgID: "@mozilla.org/csHttpObserver;1",

	myName: "CookieSafe Http Observer",

	csHttpFactory: {
		QueryInterface: function (aIID) {
			if (!aIID.equals(Components.interfaces.nsISupports) &&
			    !aIID.equals(Components.interfaces.nsIFactory))
				throw Components.results.NS_ERROR_NO_INTERFACE;
			return this;
		},

		createInstance: function (outer, iid) {
			return csHttpObserver;
		}
	},

	canUnload: function(compMgr) {
		return true;
	}
};

function NSGetModule(compMgr, fileSpec) {
	return csHttpModule;
}
