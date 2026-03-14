/**
 * RSA COMMAND CENTER - FULLY OPTIMIZED APPS SCRIPT
 * Updated: Support for BH (Premium), MAT (Temp), and SAPD (Temp) vehicle formats
 */

function doGet(e) {
  var trackingSheetId = '1MOF5wsDYuup4L3pV26PZpFxbMC0LzcYEYk7SQ3HM9sc';
  var trackingSpreadsheet = SpreadsheetApp.openById(trackingSheetId);
  var alertsSheet = trackingSpreadsheet.getSheetByName('Alerts');

  // Safely check if 'e' and 'e.parameter' exist
  var action = (e && e.parameter) ? e.parameter.action : null;

  // 1. DISPATCH ALERT LOGIC
  if (action === 'dispatchAlert') {
    var agentName = e.parameter.agentName;
    var vehicleNumber = e.parameter.vehicleNumber;
    var requirement = e.parameter.requirement;
    var timestamp = new Date().getTime();

    if (alertsSheet) {
      // Appends: [Timestamp, Agent Name, Vehicle Number, Requirement Type, Status]
      alertsSheet.appendRow([timestamp, agentName, vehicleNumber, requirement, "PENDING"]);
    }

    return ContentService.createTextOutput(JSON.stringify({ "status": "success", "message": "Alert dispatched" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 2. CLEAR ALERT LOGIC
  if (action === 'clearAlert') {
    var timestampId = e.parameter.timestamp;

    if (alertsSheet && String(timestampId).indexOf("LIVE_") === -1) {
      var vals = alertsSheet.getDataRange().getValues();
      for (var k = 1; k < vals.length; k++) {
        if (String(vals[k][0]) === String(timestampId)) {
          alertsSheet.deleteRow(k + 1);
          break;
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ "status": "success", "message": "Alert cleared" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ==========================================
  // REGULAR DASHBOARD LOGIC FALLS THROUGH HERE
  // ==========================================

  var escalationSheetId = '1EqirelmIu_betev6QDNrmJuNROVJDx96cjOGGfarQ2Y';
  var escalationSpreadsheet = SpreadsheetApp.openById(escalationSheetId);

  var today = new Date();
  var dateString = Utilities.formatDate(today, 'GMT+5:30', 'dd-MM-yyyy');
  var sheet = trackingSpreadsheet.getSheetByName(dateString);

  var escalatedSheet = escalationSpreadsheet.getSheets()[0];

  var escalatedMap = {};
  if (escalatedSheet) {
    try {
      var escData = escalatedSheet.getDataRange().getValues();
      var escHeaders = escData[0] || [];
      var escVehCol = -1;
      var escLevelCol = -1;
      for (var eh = 0; eh < escHeaders.length; eh++) {
        var eName = String(escHeaders[eh]).trim().toLowerCase();
        if (eName === 'vehicle no' || eName === 'vehicle number') escVehCol = eh;
        if (eName === 'level') escLevelCol = eh;
      }
      if (escVehCol !== -1 && escLevelCol !== -1) {
        for (var er = 1; er < escData.length; er++) {
          var ev = String(escData[er][escVehCol] || "").toUpperCase().replace(/\s+/g, '');
          var el = String(escData[er][escLevelCol] || "").trim();
          if (ev.length > 3) {
            escalatedMap[ev] = el;
          }
        }
      }
    } catch (err) { }
  }

  var activeAlerts = [];
  try {
    if (alertsSheet) {
      var alertData = alertsSheet.getDataRange().getValues();
      for (var a = 1; a < alertData.length; a++) {
        if (alertData[a][1]) {
          activeAlerts.push({
            timestamp: alertData[a][0],
            agentName: alertData[a][1],
            vehicleNumber: alertData[a][2],
            requirement: alertData[a][3]
          });
        }
      }
    }
  } catch (err) { }

  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ agents: [], alerts: activeAlerts })).setMimeType(ContentService.MimeType.JSON);
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify({ agents: [], alerts: activeAlerts })).setMimeType(ContentService.MimeType.JSON);
  }

  var headers = data[0];
  var nameColIndex = -1;
  var statusColIndex = -1;
  var vehicleColIndex = -1;
  var vinColIndex = -1;
  var ticketStatusColIndex = -1;
  var pickTimeColIndex = -1;

  for (var h = 0; h < headers.length; h++) {
    var headerName = String(headers[h]).trim().toLowerCase();
    if (headerName === 'name') nameColIndex = h;
    if (headerName === 'status') statusColIndex = h;
    if (headerName === 'vehicle number') vehicleColIndex = h;
    if (headerName === 'vin number' || headerName === 'vim number' || headerName === 'vin') vinColIndex = h;
    if (headerName === 'ticket status') ticketStatusColIndex = h;
    if (headerName === 'date' || headerName === 'pick time' || headerName === 'last pick time') pickTimeColIndex = h;
  }

  if (nameColIndex === -1) {
    return ContentService.createTextOutput(JSON.stringify({ agents: [], alerts: activeAlerts })).setMimeType(ContentService.MimeType.JSON);
  }

  // --- Helper Validation Functions ---

  function isBHSeries(val) {
    if (!val) return false;
    var s = String(val).toUpperCase().replace(/\s+/g, '');
    // Matches 22BH..., 23BH..., 24BH..., 25BH... (Premium Bharat registration)
    return /^\d{2}BH\d{4}[A-Z]{1,2}$/.test(s);
  }

  function isTempSeries(val) {
    if (!val) return false;
    var s = String(val).toUpperCase().replace(/\s+/g, '');
    // Supports MAT... (e.g. MAT9798, MAT876301TA) and SAPD... (e.g. SAPD3268)
    return /^MAT\d+/.test(s) || /^SAPD\d+/.test(s);
  }

  function isRealVehicleRecord(val) {
    if (!val) return false;
    var s = String(val).toUpperCase().replace(/\s+/g, '');
    // Standard Indian VRN (e.g. DL10CX8358) 
    // PLUS support for L1 "retry" suffixes (e.g. UP16CD0662A)
    var vrnRegex = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}[A-Z]?$/;
    var vinRegex = /^[A-Z0-9]{17}$/;

    // Include Premium BH and Temporary (MAT/SAPD) in valid records
    return vrnRegex.test(s) || vinRegex.test(s) || isBHSeries(s) || isTempSeries(s);
  }

  function parseCustomDate(dateVal) {
    if (!dateVal) return null;
    if (Object.prototype.toString.call(dateVal) === "[object Date]") {
      if (!isNaN(dateVal.getTime())) return dateVal;
    }
    var str = String(dateVal).trim();
    var parts = str.split(' ');
    var dtStr = parts[0];
    var tmStr = parts[1] || "00:00:00";
    var dArr = dtStr.split(/[-/]/);
    if (dArr.length === 3) {
      var p1 = parseInt(dArr[0], 10);
      var p2 = parseInt(dArr[1], 10);
      var y = parseInt(dArr[2], 10);
      if (y < 100) y += 2000;
      var m, d;
      if (p1 > 12) { d = p1; m = p2; } else if (p2 > 12) { m = p1; d = p2; } else { m = p1; d = p2; }
      var tArr = tmStr.split(':');
      var hr = parseInt(tArr[0], 10) || 0;
      var min = parseInt(tArr[1], 10) || 0;
      var sec = parseInt(tArr[2], 10) || 0;
      return new Date(y, m - 1, d, hr, min, sec);
    }
    var fallback = new Date(str);
    if (!isNaN(fallback.getTime())) return fallback;
    return null;
  }

  var agentsMap = {};
  var nowMs = new Date().getTime();

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rawName = row[nameColIndex];
    var veh = vehicleColIndex !== -1 ? String(row[vehicleColIndex] || "").trim() : "";
    var vin = vinColIndex !== -1 ? String(row[vinColIndex] || "").trim() : "";

    var hasValidCase = isRealVehicleRecord(veh) || isRealVehicleRecord(vin);
    var nameStr = String(rawName || "").trim().toUpperCase();

    if (!nameStr || nameStr === "NAME") continue;
    if (!hasValidCase) continue;

    var agentName = String(rawName).toLowerCase().split(' ').map(function (word) {
      return word ? word.charAt(0).toUpperCase() + word.slice(1) : "";
    }).join(' ').trim();

    if (!agentsMap[agentName]) {
      agentsMap[agentName] = {
        "Name": agentName,
        "TotalCases": 0, "Premium": 0, "Temporary": 0,
        "ROS": 0, "Towing": 0, "Assigned": 0, "Dealer": 0, "Failed": 0,
        "ON GOING": 0, "possible escalation": 0, "CANCELLED": 0, "POSTPONED": 0, "CLOSED": 0, "PRECLOSE": 0,
        "Date": null,
        "_maxTimeMs": 0
      };
    }

    var agent = agentsMap[agentName];
    agent["TotalCases"]++;

    // Increment Premium (BH) / Temporary (MAT/SAPD) counters
    if (isBHSeries(veh) || isBHSeries(vin)) {
      agent["Premium"]++;
    } else if (isTempSeries(veh) || isTempSeries(vin)) {
      agent["Temporary"]++;
    }

    var status = (statusColIndex !== -1) ? String(row[statusColIndex]).trim().toUpperCase() : "";
    var cleanStatus = status.replace(/\s+/g, " ");

    if (cleanStatus === "TECH ASSIGNED" || cleanStatus === "ROS DONE") {
      agent["ROS"]++;
    }
    else if (cleanStatus === "TOWING ASSIGNED" ||
      cleanStatus === "TOWING & CUSTODY ASSIGNED" ||
      cleanStatus === "ROS FAILED - TOWING & CUSTODY ASSIGNED" ||
      cleanStatus === "VEHICLE DROPPED") {
      agent["Towing"]++;
    }
    else if (cleanStatus === "DEALER TECHNICIAN ASSIGNED" || cleanStatus === "RESOLVED BY DEALER") {
      agent["Dealer"]++;
    }

    if (cleanStatus === "TECH UNASSIGNED" ||
      cleanStatus === "TOWING UNASSIGNED" ||
      cleanStatus === "REQUIRED DEALER SUPPORT" ||
      cleanStatus === "ROS FAILED - UNABLE TO ASSIGN SERVICE" ||
      cleanStatus === "CUSTOMER WILL ESCALATE") {

      var liveId = "LIVE_ROW" + i + "_" + cleanStatus.replace(/ /g, "_");
      activeAlerts.push({
        timestamp: liveId,
        agentName: agentName,
        vehicleNumber: veh || vin || "N/A",
        requirement: status
      });
    }

    var cleanVeh = veh.toUpperCase().replace(/\s+/g, '');
    var cleanVin = vin.toUpperCase().replace(/\s+/g, '');
    var matchedEscalationLevel = escalatedMap[cleanVeh] || escalatedMap[cleanVin] || null;

    if (matchedEscalationLevel) {
      var foundVeh = escalatedMap[cleanVeh] ? veh : vin;
      var escId = "LIVE_ESC_ROW" + i + "_" + foundVeh.replace(/\s+/g, '');
      activeAlerts.push({
        timestamp: escId,
        agentName: agentName,
        vehicleNumber: foundVeh,
        requirement: matchedEscalationLevel,
        isEscalation: true
      });
    }

    if (ticketStatusColIndex !== -1) {
      var tStatus = String(row[ticketStatusColIndex]).trim().toUpperCase();
      if (tStatus === "ON GOING") agent["ON GOING"]++;
      else if (tStatus === "POSSIBLE ESCALATION" || tStatus.indexOf("POSSIBLE") > -1) agent["possible escalation"]++;
      else if (tStatus === "CANCEL" || tStatus === "CANCELLED") agent["CANCELLED"]++;
      else if (tStatus === "POSTPONED") agent["POSTPONED"]++;
      else if (tStatus === "CLOSED") agent["CLOSED"]++;
      else if (tStatus === "PRECLOSE") agent["PRECLOSE"]++;
    }

    if (pickTimeColIndex !== -1 && row[pickTimeColIndex]) {
      var parsedDate = parseCustomDate(row[pickTimeColIndex]);
      if (parsedDate) {
        var timeMs = parsedDate.getTime();
        if (timeMs > nowMs) {
          var fixD = new Date(parsedDate.getFullYear(), parsedDate.getDate() - 1, parsedDate.getMonth() + 1, parsedDate.getHours(), parsedDate.getMinutes(), parsedDate.getSeconds());
          if (fixD.getTime() <= nowMs && fixD.getTime() > agent["_maxTimeMs"]) {
            agent["_maxTimeMs"] = fixD.getTime();
            agent["Date"] = fixD.toISOString();
          } else if (timeMs > agent["_maxTimeMs"]) {
            agent["_maxTimeMs"] = timeMs;
            agent["Date"] = parsedDate.toISOString();
          }
        } else if (timeMs > agent["_maxTimeMs"]) {
          agent["_maxTimeMs"] = timeMs;
          agent["Date"] = parsedDate.toISOString();
        }
      }
    }
  }

  var result = [];
  for (var key in agentsMap) {
    delete agentsMap[key]["_maxTimeMs"];
    if (agentsMap[key]["TotalCases"] > 0) {
      result.push(agentsMap[key]);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ agents: result, alerts: activeAlerts }))
    .setMimeType(ContentService.MimeType.JSON);
}


function doPost(e) {
  return doGet(e);
}
