// Configuration defaults
let PASSWORD_HASH = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"; // SHA-256 of "volley123"
let positions = {
    liberos: {
        count: 2,
        stats: ['Aces', '+Pass', '-Pass', '+Serve Rec', '-Serve Rec'],
        names: ["l1", "l2"]
    },
    middles: {
        count: 2,
        stats: ['Aces', 'Kills', 'Blocks', 'Attack Errors'],
        names: ["m1", "m2"]
    },
    rightSides: {
        count: 2,
        stats: ['Aces', 'Kills', 'Blocks', 'Attack Errors', '+Serve Rec', '-Serve Rec'],
        names: ["rs1", "rs2"]
    },
    outsides: {
        count: 5,
        stats: ['Aces', 'Kills', 'Blocks', 'Attack Errors', '+Serve Rec', '-Serve Rec'],
        names: ["o1", "o2", "o3", "o4", "o5"]
    },
    setters: {
        count: 2,
        stats: ['Aces', 'Set:Hit', 'Set:Free-Ball', 'Set:Blocked'],
        names: ["s1", "s2"]
    }
};

// Global variables
const dataStream = [];
let scores = { home: 0, away: 0 };
let currentSet = 1;
let allSetsData = {};
const teamStatCategories = ['Aced', 'Missed Serves', 'Technical Error','Free Ball','Opp. Error', 'Opp. Tip:Point'];

// Global object to store current stat values; keys are "playerId-statName"
let currentStats = {};

// Global variables for plot data persistence
let plotData = {};  // This object holds plot info for each stat
let actionCounter = 0;

// Update saveData to also persist plotData and actionCounter
function saveData() {
    const gameNumber = document.getElementById('gameNumber').value;
    const opponent = document.getElementById('opponent').value;
    const data = {
        scores: scores,
        currentSet: currentSet,
        dataStream: dataStream,
        allSetsData: allSetsData,
        gameNumber: gameNumber,
        opponent: opponent,
        currentStats: currentStats,
        plotData: plotData,
        actionCounter: actionCounter
    };
    localStorage.setItem("volleyballData", JSON.stringify(data));
}

function loadData() {
    const storedData = localStorage.getItem("volleyballData");
    if (storedData) {
        const data = JSON.parse(storedData);
        scores = data.scores;
        currentSet = data.currentSet;
        dataStream.length = 0;
        data.dataStream.forEach(item => dataStream.push(item));
        allSetsData = data.allSetsData;
        currentStats = data.currentStats || {};
        document.getElementById('gameNumber').value = data.gameNumber || "";
        document.getElementById('opponent').value = data.opponent || "";
        document.getElementById('setNumber').textContent = currentSet;
        if(data.plotData) { plotData = data.plotData; }
        if(data.actionCounter) { actionCounter = data.actionCounter; }
    }
}

// Initialize after DOM loads
document.addEventListener('DOMContentLoaded', () => {
    window.checkPassword = checkPassword;
    window.updateSetNumber = updateSetNumber;
    window.showTab = showTab;
    window.updateScore = updateScore;
    window.confirmReset = confirmReset;
    window.downloadBothFiles = downloadBothFiles;
    window.viewPDF = viewPDF;
    window.showResetConfirmation = showResetConfirmation;
    window.resetScores = resetScores;
    window.updateStat = updateStat;

    document.getElementById('gameNumber').addEventListener('input', saveData);
    document.getElementById('opponent').addEventListener('input', saveData);

    if (sessionStorage.getItem('authenticated') === 'true') {
        document.getElementById('authOverlay').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        initializePlayers();
        loadData();
        updateUI();
        updateSetSelector();
        generateStatsTable();
        initializePlot();
    }
});

// Password check with hashing
function checkPassword() {
    const input = document.getElementById('passwordInput').value;
    if (input === PASSWORD) {
        sessionStorage.setItem('authenticated', 'true');
        document.getElementById('authOverlay').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        initializePlayers();
        loadData();
        updateUI();
        updateSetSelector();
        generateStatsTable();
        initializePlot();
    } else {
        document.getElementById('passwordError').style.display = 'block';
    }
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`button[onclick="showTab('${tabId}')"]`).classList.add('active');
    if(tabId === 'statsView') generateStatsTable();
}

function updateScore(team, change) {
    scores[team] = Math.max(scores[team] + change, 0);
    document.getElementById(`${team}Score`).textContent = scores[team];
    logScoreChange(team, change);
    saveData();
}

function updateSetNumber(change) {
    const newSet = Math.max(currentSet + change, 1);
    if (newSet !== currentSet) {
        dataStream.push({
            timestamp: new Date().toISOString(),
            type: "set_change",
            change: change,
            newSet: newSet
        });

        // Save the current set's data before resetting
        allSetsData[currentSet] = {
            scores: { ...scores },
            dataStream: [...dataStream],
            currentStats: { ...currentStats }
        };

        // Reset scores and stats for the new set
        scores = { home: 0, away: 0 };
        currentStats = {};  // Reset all individual player stats

        setChangeMarkers.push(actionCounter); // Mark set change in plot
        currentSet = newSet;
        document.getElementById("setNumber").textContent = currentSet;

        // If we have data for this set, restore it; otherwise, start fresh
        if (allSetsData[currentSet]) {
            scores = { ...allSetsData[currentSet].scores };
            dataStream.length = 0;
            dataStream.push(...allSetsData[currentSet].dataStream);
            currentStats = { ...allSetsData[currentSet].currentStats };
        } else {
            scores = { home: 0, away: 0 };
            dataStream.length = 0;
            currentStats = {};
        }

        updateUI();
        updateSetSelector();
        generateStatsTable();
        saveData();
        updatePlot();
    }
}



function updateUI() {
    // Update scores
    document.getElementById("homeScore").textContent = scores.home;
    document.getElementById("awayScore").textContent = scores.away;

    // Update stat displays from currentStats
    document.querySelectorAll(".stat span:nth-child(3)").forEach(span => {
        const statId = span.id;
        span.textContent = currentStats[statId] || 0;
    });
}


function getCurrentStatValue(player, stat) {
    const key = `${player}-${stat}`;
    return currentStats[key] || 0;
}

function updateSetSelector() {
    const selector = document.getElementById('setSelector');
    selector.innerHTML = '<option value="all">All Sets</option>';
    Object.keys(allSetsData).forEach(set => {
        selector.innerHTML += `<option value="${set}">Set ${set}</option>`;
    });
    selector.innerHTML += `<option value="${currentSet}">Current Set (${currentSet})</option>`;
}

function generateStatsTable() {
    const selectedSet = document.getElementById('setSelector').value;
    let statsData;
    if (selectedSet === 'all') {
        statsData = Object.values(allSetsData).flatMap(set => set.dataStream).concat(dataStream);
    } else if (selectedSet === currentSet.toString()) {
        statsData = allSetsData[selectedSet] ? allSetsData[selectedSet].dataStream : dataStream;
    } else {
        statsData = allSetsData[selectedSet]?.dataStream || [];
    }
    const allStats = new Set();
    const players = [];
    const teamStats = {};
    Object.entries(positions).forEach(([pos, config]) => {
        for (let i = 1; i <= config.count; i++) {
            const playerId = `${pos}-${i}`;
            const playerName = config.names[i - 1];
            const playerStats = {};
            config.stats.forEach(stat => {
                const events = statsData.filter(e => e.player === playerId && e.stat === stat);
                const value = events.length ? events[events.length - 1].newValue : 0;
                playerStats[stat] = value;
                allStats.add(stat);
            });
            players.push({ id: playerId, name: playerName, stats: playerStats });
        }
    });
    teamStatCategories.forEach(stat => {
        const events = statsData.filter(e => e.player === 'team' && e.stat === stat);
        teamStats[stat] = events.length ? events[events.length - 1].newValue : 0;
        allStats.add(stat);
    });
    let html = `<table>
        <thead>
            <tr>
                <th>Stat</th>
                <th>Team</th>
                ${players.map(p => `<th>${p.name}</th>`).join('')}
            </tr>
        </thead>
        <tbody>`;
    Array.from(allStats).sort().forEach(stat => {
        const values = players.map(p => Number(p.stats[stat]) || 0);
        const maxValue = Math.max(...values);
        const teamTotal = values.reduce((sum, v) => sum + v, 0) + (teamStats[stat] || 0);
        html += `<tr>
            <td>${stat}</td>
            <td>${teamTotal !== 0 ? teamTotal : ''}</td>
            ${players.map(p => {
                const value = Number(p.stats[stat]) || 0;
                return `<td class="${value === maxValue && value > 0 ? 'max-value' : ''}">${value !== 0 ? value : ''}</td>`;
            }).join('')}
        </tr>`;
    });
    html += `</tbody></table>`;
    document.getElementById('statsTable').innerHTML = html;
}

/* ===== PDF Generation ===== */
function buildPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    const gameNumber = document.getElementById('gameNumber').value || 'unknown';
    const opponent = document.getElementById('opponent').value || 'unknown';
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hour = now.getHours().toString().padStart(2, '0');
    const formattedDateTime = `${year}${month}${day}-${hour}`;
    doc.setFontSize(18);
    doc.text(`Volleyball Stats - Game ${gameNumber} vs ${opponent}`, 10, 20);
    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 10, 30);
    doc.addPage();
    const summaryData = [];
    Object.keys(allSetsData).forEach(set => {
      summaryData.push([`Set ${set}`, allSetsData[set].scores.home, allSetsData[set].scores.away]);
    });
    if (!allSetsData[currentSet]) {
      summaryData.push([`Set ${currentSet} (Current)`, scores.home, scores.away]);
    }
    doc.autoTable({
      head: [['Set', 'Home Score', 'Away Score']],
      body: summaryData,
      startY: 30,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 }
    });
    const processTable = (setData, setName) => {
        const playersData = {};
        const teamStats = {};
        setData.forEach(entry => {
            if (entry.player === 'team') {
                if (!teamStats[entry.stat]) teamStats[entry.stat] = 0;
                teamStats[entry.stat] = entry.newValue;
            } else if (entry.player) {
                if (!playersData[entry.player]) playersData[entry.player] = {};
                playersData[entry.player][entry.stat] = entry.newValue;
            }
        });
        const allStatsSet = new Set([...Object.keys(teamStats), ...Object.keys(playersData).flatMap(p => Object.keys(playersData[p]))]);
        const statsList = Array.from(allStatsSet).sort();
        let playerOrder = [];
        Object.entries(positions).forEach(([pos, config]) => {
            for (let i = 1; i <= config.count; i++) {
                const pid = `${pos}-${i}`;
                if (playersData[pid] !== undefined) {
                    playerOrder.push({ id: pid, name: config.names[i - 1] });
                }
            }
        });
        const headerRow = ['Stat', 'Team', ...playerOrder.map(p => p.name)];
        const maxValues = {};
        statsList.forEach(stat => {
            const playerValues = playerOrder.map(player => Number(playersData[player.id]?.[stat]) || 0);
            maxValues[stat] = Math.max(...playerValues);
        });
        const tableRows = statsList.map(stat => {
            const playerValues = playerOrder.map(player => Number(playersData[player.id]?.[stat]) || 0);
            const teamTotal = playerValues.reduce((sum, v) => sum + v, 0) + (teamStats[stat] || 0);
            const row = [
                stat,
                { content: teamTotal !== 0 ? teamTotal : '', styles: {} },
                ...playerValues.map(value => ({
                    content: value !== 0 ? value : '',
                    styles: value === maxValues[stat] && value > 0 ? { fillColor: [144, 238, 144] } : {}
                }))
            ];
            return row;
        });
        doc.addPage();
        doc.setFontSize(16);
        doc.text(`${setName} Details`, 10, 20);
        doc.autoTable({
            head: [headerRow],
            body: tableRows,
            startY: 30,
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 4 },
            headStyles: { fillColor: [41, 128, 185], textColor: 255 },
            alternateRowStyles: { fillColor: [245, 245, 245] }
        });
    };
    Object.entries(allSetsData).forEach(([set, data]) => {
      processTable(data.dataStream, `Set ${set}`);
    });
    if (!allSetsData[currentSet]) {
      processTable(dataStream, `Set ${currentSet} (Current)`);
    }
    return { doc, filename: `volleyball-stats-G${gameNumber}-vs${opponent.replace(/ /g, '-')
      }-${formattedDateTime}.pdf` };
}

function downloadPDFFile() {
    const { doc, filename } = buildPDF();
    const blob = doc.output("blob");
    const octetBlob = new Blob([blob], { type: "application/octet-stream" });
    const url = URL.createObjectURL(octetBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function downloadJSONFile() {
    const gameNumber = document.getElementById('gameNumber').value || 'unknown';
    const opponent = document.getElementById('opponent').value || 'unknown';
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hour = now.getHours().toString().padStart(2, '0');
    const formattedDateTime = `${year}${month}${day}-${hour}`;
    const allDataStreams = Object.values(allSetsData).flatMap(set => set.dataStream);
    if (!allSetsData[currentSet]) {
        allDataStreams.push(...dataStream);
    }
    const filename = `volleyball-stats-G${gameNumber}-vs${opponent.replace(/ /g, '-')
      }-${formattedDateTime}.json`;
    const dataStr = JSON.stringify({
        metadata: {
            gameNumber: gameNumber,
            opponent: opponent,
            totalSets: currentSet,
            timestamp: new Date().toISOString()
        },
        actions: allDataStreams
    }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

function downloadBothFiles() {
    downloadJSONFile();
    setTimeout(downloadPDFFile, 100);
}

function viewPDF() {
    const { doc } = buildPDF();
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
}

/* ===== Other functions ===== */
function logScoreChange(team, change) {
    dataStream.push({
        timestamp: new Date().toISOString(),
        type: 'score',
        team: team,
        change: change,
        newScore: scores[team]
    });
}

function logScoreReset() {
    dataStream.push({
        timestamp: new Date().toISOString(),
        type: 'score_reset',
        previousScores: scores
    });
}

function showResetConfirmation() {
    document.getElementById('confirmationModal').style.display = 'block';
}

function confirmReset(confirmed) {
    document.getElementById('confirmationModal').style.display = 'none';
    if(confirmed) resetBoard();
}

function initializePlayers() {
    const container = document.getElementById('playersContainer');
    container.innerHTML = '';
    Object.entries(positions).forEach(([pos, config]) => {
        for(let i = 1; i <= config.count; i++) {
            const playerId = `${pos}-${i}`;
            const playerName = config.names[i - 1];
            const section = document.createElement('div');
            section.className = `player ${pos}`;
            section.innerHTML = `<h2>${playerName}</h2>`;
            config.stats.forEach(stat => {
                section.appendChild(createStatElement(playerId, stat));
            });
            container.appendChild(section);
        }
    });
    const teamDiv = document.createElement('div');
    teamDiv.className = 'player';
    let teamHtml = `<h2>Team Stats</h2>`;
    teamStatCategories.forEach(stat => {
       teamHtml += `<div class="stat">
           <span>${stat}:</span>
           <button onclick="updateStat('team', '${stat}', -1)">-</button>
           <span id="team-${stat}">0</span>
           <button onclick="updateStat('team', '${stat}', 1)">+</button>
       </div>`;
    });
    teamDiv.innerHTML = teamHtml;
    container.appendChild(teamDiv);
}

function createStatElement(playerId, statName) {
    const div = document.createElement('div');
    div.className = 'stat';
    div.innerHTML = `
        <span>${statName}:</span>
        <button onclick="updateStat('${playerId}', '${statName}', -1)">-</button>
        <span id="${playerId}-${statName}">0</span>
        <button onclick="updateStat('${playerId}', '${statName}', 1)">+</button>
    `;
    return div;
}

function updateStat(playerId, statName, change) {
    const key = `${playerId}-${statName}`;

    // If the stat doesn't exist yet, start at 0
    if (!(key in currentStats)) {
        currentStats[key] = 0;
    }

    // Update the stat value cumulatively
    currentStats[key] += change;
    currentStats[key] = Math.max(currentStats[key], 0); // Prevent negative values

    // Update UI stat value
    document.getElementById(key).textContent = currentStats[key];

    // Log event
    dataStream.push({
        timestamp: new Date().toISOString(),
        player: playerId,
        stat: statName,
        change: change,
        newValue: currentStats[key]
    });

    updatePlotData(statName);
    saveData();
}




function resetBoard() {
    // Reset scores & set tracking
    scores = { home: 0, away: 0 };
    currentSet = 1;
    setChangeMarkers = [];
    actionCounter = 0;

    // Reset all player stats
    currentStats = {};
    dataStream.length = 0;
    allSetsData = {};

    // Reset plot data
    plotData = {};
    plotData["Home Score"] = { x: [], y: [], name: "Home Score", visible: true, mode: "lines+markers", type: "scatter" };
    plotData["Away Score"] = { x: [], y: [], name: "Away Score", visible: true, mode: "lines+markers", type: "scatter" };

    // Update UI Immediately
    updateUI();
    initializePlot();
    updateSetSelector();
    generateStatsTable();
    saveData();
}




function resetScores() {
    scores = { home: 0, away: 0 };
    document.getElementById('homeScore').textContent = '0';
    document.getElementById('awayScore').textContent = '0';
    logScoreReset();
    saveData();
}

let setChangeMarkers = [];  // Stores x-axis positions of set changes
let scoreHistory = { x: [], home: [], away: [] };  // Track score progression

function updatePlotData(stat) {
    actionCounter++;

    // Calculate total for the stat across players and team
    let total = 0;
    // Player stats
    Object.keys(currentStats).forEach(key => {
        if (key.endsWith(`-${stat}`)) {
            total += currentStats[key];
        }
    });
    // Team stats
    if (teamStatCategories.includes(stat)) {
        const teamKey = `team-${stat}`;
        total += currentStats[teamKey] || 0;
    }

    if (!plotData[stat]) {
        plotData[stat] = {
            x: [],
            y: [],
            name: stat,
            visible: true,
            mode: "lines+markers",
            type: "scatter"
        };
    }

    plotData[stat].x.push(actionCounter);
    plotData[stat].y.push(total);

    // Trim to last 100 points
    if (plotData[stat].x.length > 100) {
        plotData[stat].x.shift();
        plotData[stat].y.shift();
    }

    // Update scores
    plotData["Home Score"].x.push(actionCounter);
    plotData["Home Score"].y.push(scores.home);
    plotData["Away Score"].x.push(actionCounter);
    plotData["Away Score"].y.push(scores.away);

    saveData();
    updatePlot();
}






function initializePlot() {
    // Initialize plotData with all possible stats, even if they're not populated yet
    if (!plotData || Object.keys(plotData).length === 0) {
        const allStats = new Set();
        Object.values(positions).forEach(pos => pos.stats.forEach(stat => allStats.add(stat)));
        teamStatCategories.forEach(stat => allStats.add(stat));

        plotData = {};
        Array.from(allStats).forEach(stat => {
            plotData[stat] = {
                x: [],
                y: [],
                name: stat,
                visible: true,
                mode: 'lines+markers',
                type: 'scatter'
            };
        });

        // Add Home & Away scores to plotData
        plotData["Home Score"] = {
            x: [],
            y: [],
            name: "Home Score",
            visible: true,
            mode: "lines+markers",
            type: "scatter",
            line: { color: "blue" }
        };

        plotData["Away Score"] = {
            x: [],
            y: [],
            name: "Away Score",
            visible: true,
            mode: "lines+markers",
            type: "scatter",
            line: { color: "red" }
        };

        // Add Set Change lines to plotData
        plotData["Set Change"] = {
            x: [],
            y: [],
            name: "Set Change",
            visible: true,
            mode: "lines",
            type: "scatter",
            line: { color: "black", dash: "dash" }
        };
    }

    // Create toggle controls for all stats and Set Change lines
    const plotControls = document.getElementById("plotControls");
    plotControls.innerHTML = `
        <h3>Visible Stats:</h3>
        <div class="plot-toggle-buttons">
            <button onclick="toggleAllPlots(true)">Select All</button>
            <button onclick="toggleAllPlots(false)">Deselect All</button>
        </div>
    `;

    Object.keys(plotData).forEach(stat => {
        const label = document.createElement("label");
        label.style.marginRight = "15px";
        label.innerHTML = `
            <input type="checkbox" ${plotData[stat].visible ? "checked" : ""}
                onchange="togglePlotLine('${stat}')"> ${stat}
        `;
        plotControls.appendChild(label);
    });

    updatePlot();
}


function togglePlotLine(stat) {
    plotData[stat].visible = !plotData[stat].visible;
    updatePlot();
}

function updatePlot() {
    let traces = Object.values(plotData).filter(trace => trace.visible);

    // Add vertical lines for set changes if "Set Change" is visible
    if (plotData["Set Change"].visible) {
        setChangeMarkers.forEach(setX => {
            traces.push({
                x: [setX, setX],
                y: [0, Math.max(...Object.values(plotData).flatMap(d => d.y))], 
                mode: "lines",
                name: "Set Change",
                line: { color: "black", dash: "dash" }
            });
        });
    }

    const layout = {
        title: "Real-Time Stat Tracking",
        xaxis: { title: "Action Number" },
        yaxis: { title: "Cumulative Value" },
        showlegend: true,
        margin: { t: 40, b: 80, l: 60, r: 20 },
        hovermode: "closest"
    };

    Plotly.newPlot("livePlot", traces, layout, { responsive: true });
}

function toggleAllPlots(state) {
    Object.keys(plotData).forEach(stat => {
        plotData[stat].visible = state;
    });

    // Update checkboxes
    document.querySelectorAll('#plotControls input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = state;
    });

    updatePlot();
    saveData();
}