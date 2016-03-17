"use strict";

var remote = require('remote')
const electron = remote.require('electron');
// Module to control application life.
const app = electron.app;
const clipboard = electron.clipboard;
var fs = require('fs')

var Menu = remote.require('menu')
var MenuItem = remote.require('menu-item')
let hoxy = require('hoxy');
var jsonfile = require('jsonfile');
var beautify_js = require('js-beautify').js_beautify
var beautify_html = require('js-beautify').html

angular.module("BoxyApp", ['ui.codemirror'])
.controller("MainController", function($scope, $sce) {
  this.serverList = [
    /*
    {
      name: "HTTP Bin",
      remoteURL: "http://httpbin.org",
      localPort: "8080",
      started: false,
      requestList: []
    },
    {
      name: "Example.com",
      remoteURL: "http://example.com",
      localPort: "8081",
      started: false,
      requestList: []
    }
    */
  ];
  this.editableServer = {
    name: "",
    remoteURL: "",
    localPort: "",
    started: false
  }
  this.selectedServer = undefined;
  this.dialogMode = "ADD";
  this.selectedRequest = undefined;
  this.selectedRequestIndex = undefined;
  this.activeTab = 'response';
  this.requestBodyFormat = 'pretty';
  this.responseBodyFormat = 'pretty';
  this.showHeaders = false;
  this.requestEditorOptions = {
    lineWrapping : true,
    lineNumbers: true,
    theme: 'eclipse',
    mode: ''
  };
  this.responseEditorOptions = {
    lineWrapping : true,
    lineNumbers: true,
    theme: 'eclipse',
    mode: ''
  };
  this.displayFilter = {
      urlFilter: "",
      requestBodyFilter: "",
      responseBodyFilter: ""
  };

  this.isServerSelected = function(server) {
    return server === this.selectedServer;
  }
  this.selectServer = function(server) {
    this.selectedServer = server;
    this.selectedRequest = undefined;
    this.selectedRequestIndex = undefined;
  }
  this.startButtonEnabled = function() {
    return this.selectedServer !== undefined && !this.selectedServer.started;
  }
  this.stopButtonEnabled = function() {
    return this.selectedServer !== undefined && this.selectedServer.started;
  }
  this.openNewServerDialog = function() {
    this.dialogMode = "ADD";
    this.editableServer.name = "";
    this.editableServer.remoteURL = "";
    this.editableServer.localPort = "";

    document.getElementById("editableServerDialog").showModal();
  }
  this.closeNewServerDialog = function() {
    document.getElementById("editableServerDialog").close();
  }

  function getUserHome() {
    return process.env.HOME || process.env.USERPROFILE;
  }

  this.saveServerFile = function() {
    var file = getUserHome() + "/" + ".boxy";
    var serverList = this.serverList.map(server => {
      return {
        name: server.name,
        remoteURL: server.remoteURL,
        localPort: server.localPort
      }
    });

    jsonfile.writeFile(file, serverList, (err) => {
      if (err !== null) {
        alert(`Filed to save settings: ${file}`);
        console.error(err);
      }
    });
  }

  this.loadServerFile = function() {
    var file = getUserHome() + "/" + ".boxy";

    jsonfile.readFile(file, (err, obj) => {
      if (err !== null || obj === undefined) {
        if (err.code !== 'ENOENT') {
          alert(`Filed to load settings: ${file}`);
        }
        console.error(err);
      } else {
        this.serverList = obj.map(server => {
          //Fill in mandatory fields
          server.requestList = [];
          server.masterRequestList = [];
          server.started = false;
          server.displayFilter = {};

          return server;
        });
        $scope.$apply();
      }
    });
  }

  this.addNewServer = function() {
    console.log("Adding new server.");
    this.closeNewServerDialog();
    var server = {
      name: this.editableServer.name,
      remoteURL: this.editableServer.remoteURL,
      localPort: this.editableServer.localPort,
      started: this.editableServer.started,
      requestList: [],
      masterRequestList: [],
      displayFilter: {}
    }
    this.serverList.push(server);
    this.selectedServer = server;
    this.saveServerFile();
  };

  this.removeServer = function() {
    if (this.selectedServer === undefined) {
      return;
    }

    var idx = this.serverList.indexOf(this.selectedServer);

    if (idx < 0) {
      return;
    }

    //Stop the server.
    if (this.selectedServer.started) {
      this.stopServer();
    }

    //Remove the server.
    this.serverList.splice(idx, 1);

    this.selectedServer = undefined;

    this.saveServerFile();
  }

  this.openEditServerDialog = function() {
    if (this.selectedServer === undefined) {
      return;
    }

    this.dialogMode = "EDIT";

    this.editableServer.name = this.selectedServer.name;
    this.editableServer.remoteURL = this.selectedServer.remoteURL;
    this.editableServer.localPort = this.selectedServer.localPort;

    document.getElementById("editableServerDialog").showModal();
  }

  this.updateServerSettings = function() {
    if (this.selectedServer === undefined) {
      return;
    }

    this.selectedServer.name = this.editableServer.name;
    this.selectedServer.remoteURL = this.editableServer.remoteURL;
    this.selectedServer.localPort = this.editableServer.localPort;

    if (this.selectedServer.started) {
      //Restart the server
      this.stopServer();
      this.startServer();
    }

    document.getElementById("editableServerDialog").close();

    this.saveServerFile();
  }

  function matchesFilter(displayFilter, req) {
    if (displayFilter.urlFilter !== undefined && displayFilter.urlFilter.length > 0 && req.request.url.indexOf(displayFilter.urlFilter) < 0) {
      return false;
    }

    if (displayFilter.requestBodyFilter !== undefined && displayFilter.requestBodyFilter.length > 0 &&  req.requestText.indexOf(displayFilter.requestBodyFilter) < 0) {
      return false;
    }

    if (displayFilter.responseBodyFilter !== undefined && displayFilter.responseBodyFilter.length > 0 &&  req.responseText.indexOf(displayFilter.responseBodyFilter) < 0) {
      return false;
    }

    return true;
  }

  this.applyFilter = function() {
    if (this.selectedServer === undefined) {
      return;
    }

    this.selectedServer.displayFilter = this.displayFilter;

    this.selectedServer.requestList = this.selectedServer.masterRequestList.filter((req) => {
      return matchesFilter(this.selectedServer.displayFilter, req);
    });

    this.selectedRequest = undefined;
    this.selectedRequestIndex = undefined;

    this.closeDisplayFilterDialog();
  }

  this.clearDisplayFilter = function() {
    this.displayFilter = {};
  }

  this.startServer = function() {
    if (this.selectedServer === undefined || this.selectedServer.started) {
      return;
    }

    var textTypes = [
      "application/xml",
      "text/xml",
      "application/json",
      "text/html",
      "text/json"
    ];
    var theServer = this.selectedServer; //Closure variable

    theServer.proxy = hoxy.createServer({
      reverse: theServer.remoteURL
    })
    .listen(theServer.localPort, () => {
      theServer.started = true;
      $scope.$apply();

      theServer.proxy.intercept({
        phase: 'request',
        as: 'buffer'
      }, (req, resp, cycle) => {
        //console.log(req.buffer.toString('utf8'));
        var contentType = req.headers["content-type"];
        var reqTxt = "";

        if (textTypes.some((type) => {
            return contentType !== undefined && contentType.startsWith(type);
        })) {
          console.log("Detected text type request.")
          var buff = req.buffer;
          if (buff !== undefined) {
            reqTxt = buff.toString('utf8');
          } else {
            console.log("Request buffer is undefined.");
          }
        }
        req.boxyRequestData = {
          requestText: reqTxt,
          request: req,
          startTime: new Date()
        };
      });

      theServer.proxy.intercept({
        phase: 'response',
        as: 'buffer'
      }, (req, resp, cycle) => {
        console.log(req);
        console.log(resp);
        var contentType = resp.headers["content-type"];
        var respTxt = "";

        if (textTypes.some((type) => {
            return contentType !== undefined && contentType.startsWith(type);
        })) {
          console.log("Detected text type response.")
          var buff = resp.buffer;
          if (buff !== undefined) {
            respTxt = buff.toString('utf8');
          } else {
            console.log("Response buffer is undefined.");
          }
        }

        var newRequest = req.boxyRequestData;

        //Remove circular reference
        req.boxyRequestData = undefined;

        newRequest.response = resp;
        newRequest.responseText = respTxt;
        newRequest.endTime = new Date();
        newRequest.duration = newRequest.endTime.getTime() -
          newRequest.startTime.getTime();
        newRequest.formattedStartTime = "" +
          (newRequest.startTime.getMonth() + 1) + "/" +
          newRequest.startTime.getDate() + "/" +
          newRequest.startTime.getFullYear() + " " +
          newRequest.startTime.getHours() + ":" +
          newRequest.startTime.getMinutes();

        var typeTable = this.getContentTypeTable(newRequest.request);
        if (typeTable !== undefined && typeTable[1] === "javascript") {
          newRequest.requestTextFormatted = beautify_js(newRequest.requestText, { indent_size: 2 });
        }
        if (typeTable !== undefined && typeTable[1] === "xml") {
          newRequest.requestTextFormatted = beautify_html(newRequest.requestText, { indent_size: 2 });
        }

        var typeTable = this.getContentTypeTable(newRequest.response);
        if (typeTable !== undefined && typeTable[1] === "javascript") {
          newRequest.responseTextFormatted = beautify_js(newRequest.responseText, { indent_size: 2 });
        }
        if (typeTable !== undefined && typeTable[1] === "xml") {
          newRequest.responseTextFormatted = beautify_html(newRequest.responseText, { indent_size: 2 });
        }

        //Add to the master list
        theServer.masterRequestList.push(newRequest);
        //Add to the filter list on if the request matches the filter
        if (matchesFilter(theServer.displayFilter, newRequest)) {
          theServer.requestList.push(newRequest);
        }

        $scope.$apply();
        window.setTimeout(() => {
          var objDiv = document.getElementById("requestListContainer");
          objDiv.scrollTop = objDiv.scrollHeight;
        });
      });
    })
    .on("error", function(err) {
      console.log(err);
      if (err.code === 'EADDRINUSE') {
        alert(`Could not start server. Port ${err.port} is already in use.`);
      } else if (err.code === 'EACCES') {
          alert(`Could not start server. You don't have access to port ${err.port}.`);
      } else {
        alert("Failed to start server.")
      }
    });
  }

  this.stopServer = function() {
    if (this.selectedServer === undefined || !this.selectedServer.started) {
      return;
    }

    this.selectedServer.proxy.close();
    this.selectedServer.proxy = undefined;
    this.selectedServer.started = false;
  }

  this.selectRequest = function(req, index) {
    this.selectedRequest = req;
    this.selectedRequestIndex = index;
    //this.activeTab = 'response';

    // console.log("Request: %s\n", req.requestText);
    // console.log("Response: %s\n", req.responseText);

    var typeTable = this.getContentTypeTable(this.selectedRequest.request);

    this.requestEditorOptions.mode = typeTable !== undefined ?
      typeTable[1] : "";

    typeTable = this.getContentTypeTable(this.selectedRequest.response);

    this.responseEditorOptions.mode = typeTable !== undefined ?
      typeTable[1] : "";
  }

  this.isRequestSelected = function(req) {
    return this.selectedRequest === req;
  }

  this.setRequestBodyFormat = function(fmt) {
    this.requestBodyFormat = fmt;
  }

  this.setResponseBodyFormat = function(fmt) {
    this.responseBodyFormat = fmt;
  }

  //Entity can be a hoxy request or response
  this.getContentType = function(entity) {
    return entity.headers["content-type"];
  }

  this.getContentTypeTable = function(entity) {
    var textTypes = [
      ["application/xml", "xml"],
      ["text/xml", "xml"],
      ["application/json", "javascript"],
      ["text/html", "xml"],
      ["text/json", "javascript"]
    ];
    var contentType = this.getContentType(entity);
    var result = undefined;

    if (contentType === undefined) {
      return result;
    }

    textTypes.some(typeItem => {
      if (contentType.startsWith(typeItem[0])) {
        result = typeItem;

        return true;
      }

      return false;
    });

    return result;
  }

  this.copyText = function() {
    if (this.selectedRequest === undefined) {
      return;
    }

    var textToCopy = "";

    if (this.activeTab === 'request') {
      textToCopy = this.selectedRequest.requestText;
    } else if (this.activeTab === 'response') {
      textToCopy = this.selectedRequest.responseText;
    }
    clipboard.writeText(textToCopy);
  }

  this.removeAllRequests = function() {
    if (this.selectedServer === undefined) {
      return;
    }

    this.selectedServer.masterRequestList.length = 0;
    this.selectedServer.requestList.length = 0;
    this.selectedRequest = undefined;
    this.this.selectedRequestIndex = undefined;
  }

  this.exportAllRequests = function() {
    electron.dialog.showSaveDialog({title: "Export body"}, (path) => {
      var s = fs.createWriteStream(path);

      this.selectedServer.requestList.forEach((req) => {
        s.write(req.requestText);
        s.write("\n");
        s.write(req.responseText);
        s.write("\n");
      });

      s.end();
      alert(`All body has been exported to: ${path}`);
    });
  }

  this.moveRequestSelection = function(event) {
    var by = 0;

    if (event.keyCode === 40) {
      by = 1;
    } else if (event.keyCode === 38) {
      by = -1;
    } else {
      return;
    }

    console.log("Moving selection by: %d", by);

    if (this.selectedRequest === undefined || this.selectedRequestIndex === undefined) {
      return;
    }

    var newIndex = this.selectedRequestIndex + by;

    if (newIndex >= this.selectedServer.requestList.length) {
      //Already at the end
      return;
    }
    if (newIndex < 0) {
      //Already at the start
      return;
    }

    this.selectRequest(this.selectedServer.requestList[newIndex], newIndex);
  }

  this.openDisplayFilterDialog = function() {
    if (this.selectedServer === undefined) {
      return;
    }

    this.displayFilter = this.selectedServer.displayFilter;
    document.getElementById("displayFilterDialog").showModal();
  }

  this.closeDisplayFilterDialog = function() {
    document.getElementById("displayFilterDialog").close();
  }

  this.calculateAggregateReport = function() {
    var report = {
      numRequests: 0,
      totalResponseTime: 0,
      avgResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: 0
    };

    if (this.selectedServer === undefined || this.selectedServer.requestList.length === 0) {
      this.report = report;

      return;
    }

    report.numRequests = this.selectedServer.requestList.length;

    this.selectedServer.requestList.forEach((req, index) => {
      if (index === 0) {
        report.maxResponseTime = report.minResponseTime = req.duration;
      }

      report.totalResponseTime += req.duration;
      report.maxResponseTime = req.duration > report.maxResponseTime ? req.duration : report.maxResponseTime;
      report.minResponseTime = req.duration < report.minResponseTime ? req.duration : report.minResponseTime;
    });

    report.avgResponseTime = report.totalResponseTime / report.numRequests;

    this.report = report;
  }

  this.openAggregateReportDialog = function() {
    if (this.selectedServer === undefined) {
      return;
    }

    this.calculateAggregateReport();

    document.getElementById("aggregateReportDialog").showModal();
  }

  this.closeAggregateReportDialog = function() {
    document.getElementById("aggregateReportDialog").close();
  }

  this.init = function() {
    var template = [
      {
          label: app.getName(),
          submenu: [
            {
              label: 'About ' + name,
              role: 'about'
            },
            {
              type: 'separator'
            },
            {
              label: 'Quit',
              accelerator: 'Command+Q',
              click: function() { app.quit(); }
            },
          ]
        },
        {
          label: "Edit",
          submenu: [
              { label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
              { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
              { type: "separator" },
              { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
              { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
              { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
              { label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
          ]
        }
    ];

    var menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    // Build our new menu
    var menu = new Menu()
    menu.append(new MenuItem({
      label: 'Open developer tool',
      click: function() {
        remote.getCurrentWindow().webContents.openDevTools();
      }
    }))
    menu.append(new MenuItem({
      label: 'More Info...',
      click: function() {
        // Trigger an alert when menu item is clicked
        alert('Here is more information')
      }
    }))

    document.addEventListener('contextmenu', function (event) {
      menu.popup(remote.getCurrentWindow());
    });

    this.loadServerFile();
  }

  this.init(); //Initialize the controller.
});
