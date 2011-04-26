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


var csShutdownObserver = {

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
	},

	uninit: function() {
		var os = this.getObserver();
		os.removeObserver(this, 'quit-application');
	},

	observe: function(aSubject, aTopic, aData) {
		if (aTopic == 'app-startup') {
			//register quit-application observer for cookiesafe shutdown tasks
			this.init();
		}

		if (aTopic == 'quit-application') {
			//unregister observer for quit-application notifications
			this.uninit();

			//perform cleanup for CS Lite shutdown
			this.exit();
		}
	},

	exit: function() {
		//remove temp exceptions
		this.removeTempExceptions();

		//clear last 10 hosts array
		var lastten = this.getCSLast10Hosts();
		lastten.clearLastTenHosts();

		//clear all cookies and exceptions
		var prefs = this.getPrefs();
		var clck = prefs.getBoolPref('clearCookies');
		var clex = prefs.getBoolPref('clearExceptions');
		if (clck) this.clearCookies2();
		if (clex) this.clearExceptions2();

		//export all cookies and exceptions
		var exck = prefs.getBoolPref('exportCookiesExit');
		var exex = prefs.getBoolPref('exportExceptionsExit');
		if (exck) this.exportCookies();
		if (exex) this.exportExceptions();

		//check if browser is TB2 and close db connection if possible
		var brows = this.getAppInfo();
		var num = parseInt(brows.version);
		if (brows.name=='Thunderbird' && num==2) {
			var permMngr = this.getPermManager();
			permMngr.closeDB();
		}
	},

	getCSLast10Hosts: function() {
		return Components.classes['@mozilla.org/CSLast10Hosts;1'].
		getService(Components.interfaces.nsICSLast10Hosts);
	},

	getCSTempExceptions: function() {
		return Components.classes['@mozilla.org/CSTempExceptions;1'].
		getService(Components.interfaces.nsICSTempExceptions);
	},

	getAppInfo: function() {
		return Components.classes['@mozilla.org/xre/app-info;1'].
		createInstance(Components.interfaces.nsIXULAppInfo);
	},

	getPrefs: function() {
		return Components.classes["@mozilla.org/preferences-service;1"].
		getService(Components.interfaces.nsIPrefService).
		getBranch("cookiesafe.");
	},

	getCookieManager: function() {
		return Components.classes["@mozilla.org/cookiemanager;1"].
		getService(Components.interfaces.nsICookieManager);
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

	removeTempExceptions: function() {
		var tempExc = this.getCSTempExceptions();
		var perms = tempExc.getTempExceptions();
		if (!perms) return false;

		//remove temp exceptions
		perms = perms.split(' ');
		var mngr = this.getPermManager();
		for (var i=0; i<perms.length; ++i) {
			if (!perms[i]) continue;
			try {
				mngr.remove(perms[i],'cookie');
			} catch(e) {
				continue;
			}
		}

		//this clears the temp array and the tempExceptions char pref
		tempExc.clearTempExceptions();
		return false;
	},

	clearCookies2: function() {
		var mngr = this.getCookieManager();
		mngr.removeAll();
	},

	clearExceptions2: function() {
		var prefs = this.getPrefs();
		var protectBlocked = prefs.getBoolPref('protectBlockedSites');

		var exc,perms,temp;
		var mngr = this.getPermManager();
		if (mngr instanceof Components.interfaces.nsIPermissionManager) {
			perms = mngr.enumerator;
			while (('hasMoreElements' in perms && perms.hasMoreElements()) ||
				 ('hasMore' in perms && perms.hasMore())) {
				exc = perms.getNext();
				exc.QueryInterface(Components.interfaces.nsIPermission);
				if (protectBlocked && exc.capability == 2) continue;
				if (exc.type=='cookie') {
					mngr.remove(exc.host,'cookie');
				}
			}
		} else { //for TB2 only
			if (protectBlocked) {
				var perms = mngr.getAllPermissions().split(' ');
				for (var i=0; i<perms.length; ++i) {
					if (!perms[i]) continue;
					temp = perms[i].split('|');
					temp[1] = parseInt(temp[1]);
					if (temp[1] == 2) {
						continue;
					} else {
						mngr.remove(temp[0],'cookie');
					}
				}
			} else {
				mngr.removeAll();
			}
		}
	},

	exportCookies: function() {
		var file,ck,host,path,name,value,secure,http,session,expires,escaped;
		var prefs = this.getPrefs();
		var url = prefs.getCharPref('cookiesLocation');

		if (url) var uri = this.getURI(url);

		if (!url || uri.scheme != 'file') {
			return false;
		} else {
			file = this.convertUrlToFile(uri.spec);
		}

		if (!file) return false;

		//output the xml header
		var output = '<?xml version=\"1.0\"?>\r\n\r\n<cookies>\r\n';

		try {
			//this will overwrite all existing content
			this.writeFile(file, output, 0x04 | 0x08 | 0x20);
		} catch(e) {
			alert(e);
		}

		//loop through cookies and export them one at a time
		var mngr = this.getCookieManager();
		var cookies = mngr.enumerator;
		while (cookies.hasMoreElements()) {
			ck = cookies.getNext();
			ck.QueryInterface(Components.interfaces.nsICookie);
			ck.QueryInterface(Components.interfaces.nsICookie2);

			escaped = (escape(ck.host) != ck.host) ? true : false; //if true it needs to be escaped
			if (unescape(ck.host) != ck.host) escaped = false; //already escaped so do nothing
			host = (escaped) ? '<host escaped=\'true\'>'+escape(ck.host)+'</host>' : '<host>'+ck.host+'</host>';

			escaped = (escape(ck.path) != ck.path) ? true : false;
			if (unescape(ck.path) != ck.path) escaped = false;
			path = (escaped) ? '<path escaped=\'true\'>'+escape(ck.path)+'</path>' : '<path>'+ck.path+'</path>';

			escaped = (escape(ck.name) != ck.name) ? true : false;
			if (unescape(ck.name) != ck.name) escaped = false;
			name = (escaped) ? '<name escaped=\'true\'>'+escape(ck.name)+'</name>' : '<name>'+ck.name+'</name>';

			escaped = (escape(ck.value) != ck.value) ? true : false;
			if (unescape(ck.value) != ck.value) escaped = false;
			value = (escaped) ? '<value escaped=\'true\'>'+escape(ck.value)+'</value>' : '<value>'+ck.value+'</value>';

			secure = '<secure>'+ck.isSecure+'</secure>';

			http = ('isHttpOnly' in ck) ? '<http>'+ck.isHttpOnly+'</http>' : '<http>false</http>';

			session = '<session>'+ck.isSession+'</session>';

			expires = '<expires>'+ck.expiry+'</expires>';

			output = '\t<cookie>\r\n\t\t'+host+'\r\n\t\t'+path+'\r\n\t\t'+name+'\r\n\t\t'+value+'\r\n\t\t'+
				 secure+'\r\n\t\t'+http+'\r\n\t\t'+session+'\r\n\t\t'+expires+'\r\n\t</cookie>\r\n';

			try {
				//this will append to existing content
				this.writeFile(file, output, 0x04 | 0x10);
			} catch(e) {
				alert(e);
			}
		}

		//output the xml footer
		output = '</cookies>\r\n';

		try {
			//this will append to existing content
			this.writeFile(file, output, 0x04 | 0x10);
		} catch(e) {
			alert(e);
		}

		return false;
	},

	exportExceptions: function() {
		var file,exc,perms,host,cap,escaped,temp;
		var prefs = this.getPrefs();
		var url = prefs.getCharPref('exceptionsLocation');

		if (url) var uri = this.getURI(url);

		if (!url || uri.scheme != 'file') {
			return false;
		} else {
			file = this.convertUrlToFile(uri.spec);
		}

		if (!file) return false;

		//output the xml header
		var output = '<?xml version=\"1.0\"?>\r\n\r\n<permissions>\r\n';

		try {
			//this will overwrite all existing content
			this.writeFile(file, output, 0x04 | 0x08 | 0x20);
		} catch(e) {
			alert(e);
		}

		//loop through exceptions and export them one at a time
		var mngr = this.getPermManager();
		if (mngr instanceof Components.interfaces.nsIPermissionManager) {
			perms = mngr.enumerator;
			while (perms.hasMoreElements()) {
				exc = perms.getNext();
				exc.QueryInterface(Components.interfaces.nsIPermission);
				if (exc.type=='cookie') {
					output = this.formatExceptionsOutput(exc.host,exc.capability);

					try {
						//this will append to existing content
						this.writeFile(file, output, 0x04 | 0x10);
					} catch(e) {
						alert(e);
					}
				}
			}
		} else { //for TB2 only
			perms = mngr.getAllPermissions().split(' ');
			for (var i=0; i<perms.length; ++i) {
				if (!perms[i]) continue;
				temp = perms[i].split('|');
				output = this.formatExceptionsOutput(temp[0],temp[1]);

				try {
					//this will append to existing content
					this.writeFile(file, output, 0x04 | 0x10);
				} catch(e) {
					alert(e);
				}
			}
		}

		//output the xml footer
		output = '</permissions>\r\n';

		try {
			//this will append to existing content
			this.writeFile(file, output, 0x04 | 0x10);
		} catch(e) {
			alert(e);
		}

		return false;
	},

	writeFile: function(sFilePath, sFileContent, flags) {
		var strm = Components.classes["@mozilla.org/network/file-output-stream;1"].
			createInstance(Components.interfaces.nsIFileOutputStream);
		strm.QueryInterface(Components.interfaces.nsIOutputStream);
		strm.QueryInterface(Components.interfaces.nsISeekableStream);
		strm.init(sFilePath, flags, 420, 0);
		strm.write(sFileContent, sFileContent.length);
		strm.flush();
		strm.close();
	},

	formatExceptionsOutput: function(hst,capability) {
		var escaped = (escape(hst) != hst) ? true : false; //if true it needs to be escaped
		if (unescape(hst) != hst) escaped = false; //already escaped so do nothing
		var host = (escaped) ? '<host escaped=\'true\'>'+escape(hst)+'</host>' : '<host>'+hst+'</host>';

		var cap = '<capability>'+capability+'</capability>';

		var output = '\t<exception>\r\n\t\t'+host+'\r\n\t\t'+cap+'\r\n\t</exception>\r\n';
		return output;
	},

	getURI: function(url) {
		return Components.classes["@mozilla.org/network/io-service;1"].
		getService(Components.interfaces.nsIIOService).
		newURI(url,null,null);
	},

	convertUrlToFile: function(url) {
		return Components.classes['@mozilla.org/network/protocol;1?name=file'].
		createInstance(Components.interfaces.nsIFileProtocolHandler).
		getFileFromURLSpec(url);
	}
};

var csShutdownModule = {

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
		return this.csShutdownFactory;
	},

	myCID: Components.ID("{f21325de-8f9d-41f9-a628-048ec6847a97}"),

	myProgID: "@mozilla.org/csShutdownObserver;1",

	myName: "CookieSafe Shutdown Observer",

	csShutdownFactory: {
		QueryInterface: function (aIID) {
			if (!aIID.equals(Components.interfaces.nsISupports) &&
			    !aIID.equals(Components.interfaces.nsIFactory))
				throw Components.results.NS_ERROR_NO_INTERFACE;
			return this;
		},

		createInstance: function (outer, iid) {
			return csShutdownObserver;
		}
	},

	canUnload: function(compMgr) {
		return true;
	}
};

function NSGetModule(compMgr, fileSpec) {
	return csShutdownModule;
}
