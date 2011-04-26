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



var cs3rdPartyObserver = {

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

	init: function() {
		var os = this.getObserver();
		os.addObserver(this, 'quit-application', false);
		os.addObserver(this, 'http-on-examine-response', false);
		os.addObserver(this, 'http-on-examine-merged-response', false);
	},

	uninit: function() {
		var os = this.getObserver();
		os.removeObserver(this, 'quit-application');
		os.removeObserver(this, 'http-on-examine-response');
		os.removeObserver(this, 'http-on-examine-merged-response');
	},

	observe: function(aSubject, aTopic, aData) {
		if (aTopic == 'app-startup') {
			//init the http observer
			this.init();
		}

		if (aTopic == 'quit-application') {
			//uninit the http observer
			this.uninit();

		}

		if (aTopic != 'http-on-examine-response' &&
                    aTopic != 'http-on-examine-merged-response') return false;

		try {
			var c = aSubject.QueryInterface(Components.interfaces.nsIChannel);
			var r = aSubject.QueryInterface(Components.interfaces.nsIRequest);
			var hc = aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);
			var hci = aSubject.QueryInterface(Components.interfaces.nsIHttpChannelInternal);
		} catch(e) {
			return false;
		}

		if (c.URI.scheme.substr(0,4) != 'http') return false;

		try {
			var header = hc.getResponseHeader("Set-Cookie");
			if (!header) return false;
		} catch(e) {
			return false;
		}

		var prefs = this.getPrefs();
		var log3rd = prefs.getBoolPref('log3rdParty');
		var blk3rd = prefs.getBoolPref('block3rdParty');
		var blkunknown = prefs.getBoolPref('blockUnknown');

		var cs = this.getCS();
		var thirdparty = false;
		var ckperm = this.getCookiePermission();
		var uri=doc=req=req2=win=win2=isFrame=isFrame2=ckhost=null;
		var test1=test2=test3=test4=test5=test6=test7=test8=test9=test10=null;

		//get the cookie host from the nsIChannel
		try {
			ckhost = cs.removeSub(c.URI.host);
			if (!ckhost || ckhost == 'browser') return false;
		} catch(e) {
			return false;
		}

		//get the host of the document
		try {
			test1 = cs.removeSub(hci.documentURI.host);
			if (!blkunknown && (!test1 || test1 == 'browser')) test1 = null;
		} catch(e) {
			test1 = null;
		}

		if (test1 && ckhost != (doc = test1)) {
			thirdparty = true;
			this.logAndBlock(ckhost,doc,aTopic,c,hc);
			return false;
		}

		//get the original uri
		try {
			test2 = cs.removeSub(c.originalURI.host);
			if (!blkunknown && (!test2 || test2 == 'browser')) test2 = null;
		} catch(e) {
			test2 = null;
		}

		if (test2 && ckhost != (doc = test2)) {
			thirdparty = true;
			this.logAndBlock(ckhost,doc,aTopic,c,hc);
			return false;
		}

		//get the originating uri (only works in gecko 1.9+ and has no effect on favicons)
		try {
			if ('getOriginatingURI' in ckperm) {
				uri = ckperm.getOriginatingURI(c);
				test3 = cs.removeSub(uri.host);
				if (!blkunknown && (!test3 || test3 == 'browser')) test3 = null;
			} else {
				test3 = null;
			}
		} catch(e) {
			test3 = null;
		}

		if (test3 && ckhost != (doc = test3)) {
			thirdparty = true;
			this.logAndBlock(ckhost,doc,aTopic,c,hc);
			return false;
		}

		//get the request name (pointless test, but what the hell)
		try {
			uri = this.getURI(r.name);
			test4 = cs.removeSub(uri.host);
			if (!blkunknown && (!test4 || test4 == 'browser')) test4 = null;
		} catch(e) {
			test4 = null;
		}

		if (test4 && ckhost != (doc = test4)) {
			thirdparty = true;
			this.logAndBlock(ckhost,doc,aTopic,c,hc);
			return false;
		}

		//get the request name from the load group
		try {
			if (r.loadGroup && r.loadGroup.defaultLoadRequest) {
				uri = this.getURI(r.loadGroup.defaultLoadRequest.name);
				test5 = cs.removeSub(uri.host);
			}
			if (!blkunknown && (!test5 || test5 == 'browser')) test5 = null;
		} catch(e) {
			test5 = null;
		}

		if (test5 && ckhost != (doc = test5)) {
			thirdparty = true;
			this.logAndBlock(ckhost,doc,aTopic,c,hc);
			return false;
		}

		//return here if the user isn't blocking 3rd party cookies
		if (!blk3rd) return false;

		//testing the referrer against the cookie host can cause false detections
		//try {
		//	test6 = cs.removeSub(hc.referrer.host);
		//	if (!blkunknown && (!test6 || test6 == 'browser')) test6 = null;
		//} catch(e) {
		//	test6 = null;
		//}

		/*****START nsIChannel DOM window*****/

		//get the dom window from the nsIChannel
		try {
			req = c.notificationCallbacks;
			if (req) {
				win = req.getInterface(Components.interfaces.nsIDOMWindow);
			}
		} catch(e) {
			win = null;
		}

		//determine if the cookie originates from a frame
		try {
			isFrame = (win) ? !(win == win.top) : null;
		} catch(e) {
			isFrame = null;
		}

		//get the host of the window responsible for the request (this often references a frame)
		try {
			test7 = (win) ? cs.removeSub(win.location.hostname) : null;
			if (!blkunknown && (!test7 || test7 == 'browser')) test7 = null;
		} catch(e) {
			test7 = null;
		}

		//get the host of the top window
		try {
			test8 = (win) ? cs.removeSub(win.top.location.hostname) : null;
			if (!blkunknown && (!test8 || test8 == 'browser')) test8 = null;
		} catch(e) {
			test8 = null;
		}

		if ((!test5 || isFrame) && test8 && ckhost != (doc = test8)) {
			thirdparty = true;
			this.logAndBlock(ckhost,doc,aTopic,c,hc);
			return false;
		}

		/*****START loadGroup DOM window*****/

		try {
			if (r.loadGroup && r.loadGroup.notificationCallbacks) {
				req2 = r.loadGroup.notificationCallbacks;
			}
			if (req2) {
				win2 = req2.getInterface(Components.interfaces.nsIDOMWindow);
			}
		} catch(e) {
			win2 = null;
		}

		try {
			isFrame2 = (win2) ? !(win2 == win2.top) : null;
		} catch(e) {
			isFrame2 = null;
		}

		try {
			test9 = (win2) ? cs.removeSub(win2.location.hostname) : null;
			if (!blkunknown && (!test9 || test9 == 'browser')) test9 = null;
		} catch(e) {
			test9 = null;
		}

		try {
			test10 = (win2) ? cs.removeSub(win2.top.location.hostname) : null;
			if (!blkunknown && (!test10 || test10 == 'browser')) test10 = null;
		} catch(e) {
			test10 = null;
		}

		if ((!test5 || isFrame2) && test10 && ckhost != (doc = test10)) {
			thirdparty = true;
			this.logAndBlock(ckhost,doc,aTopic,c,hc);
			return false;
		}

		//FOR TESTING PURPOSES
		//if (thirdparty) {
		//	this.testLogs(ckhost,test1,test2,test3,test4,test5,test6,isFrame,test7,test8,isFrame2,test9,test10);
		//}

		return false;
	},

	//log and block the 3rd party cookies
	logAndBlock: function(ckhost,doc,topic,c,hc) {
		var os = this.getObserver();
		var prefs = this.getPrefs();
		var console = this.getConsole();
		var log3rd = prefs.getBoolPref('log3rdParty');
		var blk3rd = prefs.getBoolPref('block3rdParty');
		var blkunknown = prefs.getBoolPref('blockUnknown');

			//remove 3rd party cookie header based on user pref
			if ((blk3rd && doc != 'browser') || (blkunknown && doc == 'browser')) {
				hc.setResponseHeader("Set-Cookie","",false);
				os.notifyObservers(c.URI,'cookie-rejected',null);
			}

			if (doc != 'browser') {
				//flag host as third party in MRH window
				var tph = this.get3rdPartyHosts();
				tph.add3rdParty(ckhost);

				//log 3rd party notification
				if (log3rd) {
					var msg = this.getStr('cookiesafe.3rdPartyDetected') + '\n' +
						this.getStr('cookiesafe.CookieHost') + ' ' + ckhost + '\n' +
						this.getStr('cookiesafe.DocumentHost') + ' ' + doc;
					console.logStringMessage(msg);
				}
			}
	},

	//this is used for testing the accuracy of 3rd party blocking and logging
	testLogs: function(ck,one,two,three,four,five,six,frm,seven,eight,frm2,nine,ten) {
		var console = this.getConsole();
		var msg = 'cookie host: '+ck+'\n'+
			'documentURI: '+one+'\n'+
			'originalURI: '+two+'\n'+
			'getOriginatingURI: '+three+'\n'+
			'name: '+four+'\n'+
			'load group name: '+five+'\n'+
			'referrer: '+six+'\n'+
			'frame: '+frm+'\n'+
			'window: '+seven+'\n'+
			'window.top: '+eight+'\n'+
			'load group frame: '+frm2+'\n'+
			'load group window: '+nine+'\n'+
			'load group window.top: '+ten+'\n';
		console.logStringMessage(msg);
	},

	getCookiePermission: function() {
		return Components.classes["@mozilla.org/cookie/permission;1"].
		createInstance(Components.interfaces.nsICookiePermission);
	},

	getCS: function() {
		return Components.classes['@mozilla.org/CookieSafe;1'].
		createInstance(Components.interfaces.nsICookieSafe);
	},

	get3rdPartyHosts: function() {
		return Components.classes['@mozilla.org/CS3rdPartyHosts;1'].
		getService(Components.interfaces.nsICS3rdPartyHosts);
	},

	getURI: function(url) {
		return Components.classes["@mozilla.org/network/io-service;1"].
		getService(Components.interfaces.nsIIOService).
		newURI(url,null,null);
	},

	getConsole: function() {
		return Components.classes["@mozilla.org/consoleservice;1"].
		getService(Components.interfaces.nsIConsoleService);
	},

	getPrefs: function() {
		return Components.classes["@mozilla.org/preferences-service;1"].
		getService(Components.interfaces.nsIPrefService).
		getBranch("cookiesafe.");
	},

	getStrBundle: function() {
		return Components.classes['@mozilla.org/intl/stringbundle;1'].
		getService(Components.interfaces.nsIStringBundleService).
		createBundle('chrome://cookiesafe/locale/cookiesafe.properties');
	},

	getStr: function(name) {
		var bdl = this.getStrBundle();
		return bdl.GetStringFromName(name);
	}
};

var cs3rdPartyModule = {

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
		return this.cs3rdPartyFactory;
	},

	myCID: Components.ID("{3913ed29-daa8-4ea4-ad3c-a04852d2568b}"),

	myProgID: "@mozilla.org/cs3rdPartyObserver;1",

	myName: "CookieSafe 3rd Party Observer",

	cs3rdPartyFactory: {
		QueryInterface: function (aIID) {
			if (!aIID.equals(Components.interfaces.nsISupports) &&
			    !aIID.equals(Components.interfaces.nsIFactory))
				throw Components.results.NS_ERROR_NO_INTERFACE;
			return this;
		},

		createInstance: function (outer, iid) {
			return cs3rdPartyObserver;
		}
	},

	canUnload: function(compMgr) {
		return true;
	}
};

function NSGetModule(compMgr, fileSpec) {
	return cs3rdPartyModule;
}
