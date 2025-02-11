/*
 * GNU AGPL-3.0 License
 *
 * Copyright (c) 2021 - present core.ai . All rights reserved.
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see https://opensource.org/licenses/AGPL-3.0.
 *
 */

// jshint ignore: start
/*eslint no-console: 0*/
/*eslint strict: ["error", "global"]*/
/*global Phoenix*/


/** Setup phoenix shell components
 *
 * This module should be functionally as light weight as possible with minimal deps as it is a shell component.
 * **/
import initVFS from "./init_vfs.js";
import ERR_CODES from "./errno.js";
import initTauriShell from "./tauriShell.js";

initVFS();

let windowLabelCount = 0;
// create a unique prefix for each window so that it doesnt collide with
// new window from other phoenix windows in same app session.
const labelPrefix = `phcode-${crypto.randomUUID().split("-")[0]}`;
Phoenix.app = {
    getNodeState: function (cbfn){
        cbfn(new Error('Node cannot be run in phoenix browser mode'));
    },
    getDisplayLocation: function (fullVFSPath) {
        // reruns a user-friendly location that can be shown to the user to make some sense of the virtual file path.
        // The returned path may not be an actual path if it is not resolvable to a platform path, but a text indicating
        // its location. Eg: "Stored in Your Browser"
        if (fullVFSPath.startsWith(Phoenix.VFS.getTauriDir())) {
            return Phoenix.fs.getTauriPlatformPath(fullVFSPath);
        }
        if (fullVFSPath.startsWith(Phoenix.VFS.getMountDir())) {
            return fullVFSPath.replace(Phoenix.VFS.getMountDir(), ""); // we don't show anything if it's stored on user's hard drive for better ui.
        }
        return window.Strings.STORED_IN_YOUR_BROWSER;
    },
    setWindowTitle: async function (title) {
        window.document.title = title;
        if(Phoenix.browser.isTauri) {
            await window.__TAURI__.window.appWindow.setTitle(title);
        }
    },
    getWindowTitle: async function () {
        if(Phoenix.browser.isTauri) {
            return window.__TAURI__.window.appWindow.title();
        }
        return window.document.title;
    },
    openPathInFileBrowser: function (fullVFSPath){
        return new Promise((resolve, reject)=>{
            if(!window.__TAURI__ ||
                !fullVFSPath.startsWith(Phoenix.VFS.getTauriDir())) {
                reject("openPathInFileBrowser is only currently supported in Native builds for tauri paths!");
                return;
            }
            if(fullVFSPath.toLowerCase().startsWith("http://")
                || fullVFSPath.toLowerCase().startsWith("https://")
                || fullVFSPath.toLowerCase().startsWith("file://")) {
                reject("Please use openPathInFileBrowser API to open URLs");
                return;
            }
            const platformPath = Phoenix.fs.getTauriPlatformPath(fullVFSPath);
            window.__TAURI__.tauri
                .invoke('show_in_folder', {path: platformPath})
                .then(resolve)
                .catch(reject);
        });
    },
    openURLInDefaultBrowser: function (url){
        return new Promise((resolve, reject)=>{
            if(!window.__TAURI__) {
                resolve(window.open(url, '_blank', 'noopener,noreferrer'));
                return;
            }
            if( !(url.toLowerCase().startsWith("http://") || url.toLowerCase().startsWith("https://")) ) {
                reject("openURLInDefaultBrowser: URL should be http or https, but was " + url);
                return;
            }
            window.__TAURI__.shell.open(url)
                .then(resolve)
                .catch(reject);
        });
    },
    openURLInPhoenixWindow: function (url, {
        windowTitle, windowLabel, fullscreen, resizable,
        height, minHeight, width, minWidth, acceptFirstMouse, preferTabs
    } = {}){
        const defaultHeight = 900, defaultWidth = 1366;
        if(window.__TAURI__){
            let tauriWindow;
            if(windowLabel) {
                tauriWindow = window.__TAURI__.window.WebviewWindow.getByLabel(windowLabel);
                if(tauriWindow) {
                    console.error(`An existing window already exists for windowLabel:${windowLabel}, please close window and call openURLInPhoenixWindow!`);
                    return tauriWindow;
                }
            }

            tauriWindow = new window.__TAURI__.window.WebviewWindow(windowLabel || `${labelPrefix}-${windowLabelCount++}`, {
                url,
                title: windowTitle || windowLabel || url,
                fullscreen,
                resizable: resizable === undefined ? true : resizable,
                height: height || defaultHeight,
                minHeight: minHeight || 600,
                width: width || defaultWidth,
                minWidth: minWidth || 800,
                acceptFirstMouse: acceptFirstMouse === undefined ? true : acceptFirstMouse
            });
            tauriWindow.isTauriWindow = true;
            return tauriWindow;
        }
        let features = 'toolbar=no,location=no, status=no, menubar=no, scrollbars=yes';
        features = `${features}, width=${width||defaultWidth}, height=${height||defaultHeight}`;
        if(resizable === undefined || resizable){
            features = features + ", resizable=yes";
        }
        if(preferTabs) {
            features = "";
        }
        const nativeWindow = window.open(url, windowLabel||'_blank', features);
        nativeWindow.isTauriWindow = false;
        return nativeWindow;
    },
    getApplicationSupportDirectory: Phoenix.VFS.getAppSupportDir,
    getExtensionsDirectory: Phoenix.VFS.getExtensionDir,
    getUserDocumentsDirectory: Phoenix.VFS.getUserDocumentsDirectory,
    getUserProjectsDirectory: Phoenix.VFS.getUserProjectsDirectory,
    getTempDirectory: Phoenix.VFS.getTempDir,
    ERR_CODES: ERR_CODES,
    getElapsedMilliseconds: function () {
        return Date.now() - Phoenix.startTime; // milliseconds elapsed since app start
    },
    language: navigator.language
};

if(!window.appshell){
    window.appshell = Phoenix;
}

if(Phoenix.browser.isTauri) {
    initTauriShell(Phoenix.app);
}
