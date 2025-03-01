const PASSWORD = "volley123";
const dataStream = [];
let scores = { home: 0, away: 0 };
let currentSet = 1;
let allSetsData = {};

const positions = {
    liberos: {
        count: 2,
        stats: ['Aces','+Pass', '-Pass', '+Serve Rec','-Serve Rec'],
        names: ["Darby", "Emma"]
    },
    middles: {
        count: 2,
        stats: ['Aces', 'Kills','Blocks', 'Attack Rrrors'],
        names: ["Alicia", "Melia"]
    },
    rightSides: {
        count: 2,
        stats: ['Aces','Kills', 'Blocks', 'Attack Errors', '+Serve Rec','-Serve Rec'],
        names: ["Julie", "Olivia"]
    },
    outsides: {
        count: 5,
        stats: ['Aces','Kills', 'Blocks', 'Attack Errors', '+Serve Rec','-Serve Rec'],
        names: ["Gabi", "Hannah","Lilianna", "Riley", "Shirley"]
    },
    setters: {
        count: 2,
        stats: ['Aces','Set:Hit','Set:Free-Ball','Set:Blocked'],
        names: ["Laila", "Naila"]
    }
};

function checkPassword() {
    const input = document.getElementById('passwordInput').value;
    if(input === PASSWORD) {
        document.getElementById('authOverlay').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        initializePlayers();
        generateStatsTable();
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
}

function updateSetNumber(change) {
    const newSet = Math.max(currentSet + change, 1);
    if(newSet !== currentSet) {
        // Log the set change action in the datastream
        dataStream.push({
            timestamp: new Date().toISOString(),
            type: 'set_change',
            change: change,
            newSet: newSet
        });
        // Save current set data
        allSetsData[currentSet] = {
            scores: {...scores},
            dataStream: [...dataStream]
        };

        currentSet = newSet;
        document.getElementById('setNumber').textContent = currentSet;
        
        // Load new set data if available, else reset scores and datastream
        if(allSetsData[currentSet]) {
            scores = {...allSetsData[currentSet].scores};
            dataStream.length = 0;
            dataStream.push(...allSetsData[currentSet].dataStream);
        } else {
            scores = { home: 0, away: 0 };
            dataStream.length = 0;
        }
        
        updateUI();
        updateSetSelector();
        generateStatsTable();
    }
}

function updateUI() {
    document.getElementById('homeScore').textContent = scores.home;
    document.getElementById('awayScore').textContent = scores.away;
    
    document.querySelectorAll('.stat span:nth-child(3)').forEach(span => {
        const [player, stat] = span.id.split('-');
        span.textContent = getCurrentStatValue(player, stat);
    });
}

function getCurrentStatValue(player, stat) {
    const events = dataStream.filter(e => e.player === player && e.stat === stat);
    return events.length ? events[events.length - 1].newValue : 0;
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

    // Process player stats
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

    // Process team stats
    ['Aced', 'Missed Serves', 'No-Touch Point', 'Technical Error'].forEach(stat => {
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

        // ✅ Team column should sum all player stats **and** dedicated team stats
        const teamTotal = values.reduce((sum, v) => sum + v, 0) + (teamStats[stat] || 0);

        html += `<tr>
            <td>${stat}</td>
            <td>${teamTotal}</td>  <!-- ✅ Now correctly summing all stats -->
            ${players.map(p => {
                const value = Number(p.stats[stat]) || 0;
                return `<td class="${value === maxValue && maxValue > 0 ? 'max-value' : ''}">${value}</td>`;
            }).join('')}
        </tr>`;
    });

    html += `</tbody></table>`;
    document.getElementById('statsTable').innerHTML = html;
}



function generatePDF() {
    const { jsPDF } = window.jspdf;
    // Create the document in landscape mode.
    const doc = new jsPDF({ orientation: 'landscape' });
    const gameNumber = document.getElementById('gameNumber').value || 'unknown';
    const opponent = document.getElementById('opponent').value || 'unknown';
  
    // Get current date and hour for filename (format: YYYYMMDD-HH)
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hour = now.getHours().toString().padStart(2, '0');
    const formattedDateTime = `${year}${month}${day}-${hour}`;
  
    // Title Page
    doc.setFontSize(18);
    doc.text(`Volleyball Stats - Game ${gameNumber} vs ${opponent}`, 10, 20);
    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 10, 30);
    doc.addPage();
  
    // Set Summaries
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
  
    // Detailed Stats
    // processTable computes the team column as the sum of all player stat values.
    const processTable = (setData, setName) => {
        const playersData = {};
        const teamStats = {};
    
        // Process all events, including team stats
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
    
        // Build player list (in order)
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
    
        // Calculate max values for each stat **excluding team column**
        const maxValues = {};
        statsList.forEach(stat => {
            const playerValues = playerOrder.map(player => Number(playersData[player.id]?.[stat]) || 0);
            maxValues[stat] = Math.max(...playerValues); // Find highest player value
        });
    
        // Build table rows
        const tableRows = statsList.map(stat => {
            const playerValues = playerOrder.map(player => Number(playersData[player.id]?.[stat]) || 0);
            const teamTotal = playerValues.reduce((sum, v) => sum + v, 0) + (teamStats[stat] || 0);
    
            // ✅ Highlight highest player values (excluding team column)
            const row = [
                stat,
                { content: teamTotal, styles: {} }, // No highlight for Team column
                ...playerValues.map(value => ({
                    content: value,
                    styles: value === maxValues[stat] && value > 0 ? { fillColor: [144, 238, 144] } : {} // Green highlight
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
    
    
    
    
  
    // Process all sets.
    Object.entries(allSetsData).forEach(([set, data]) => {
      processTable(data.dataStream, `Set ${set}`);
    });
    if (!allSetsData[currentSet]) {
      processTable(dataStream, `Set ${currentSet} (Current)`);
    }
  
    doc.save(`volleyball-stats-G${gameNumber}-vs${opponent.replace(/ /g, '-')}-${formattedDateTime}.pdf`);
  }
  
function getGameMetadata() {
    return {
        gameNumber: document.getElementById('gameNumber').value || 'unknown',
        opponent: document.getElementById('opponent').value || 'unknown'
    };
}

function getTotalHomePoints() {
    return Object.values(allSetsData).reduce((acc, set) => acc + set.scores.home, 0) + scores.home;
}

function getTotalAwayPoints() {
    return Object.values(allSetsData).reduce((acc, set) => acc + set.scores.away, 0) + scores.away;
}

function saveData() {
    const gameNumber = document.getElementById('gameNumber').value || 'unknown';
    const opponent = document.getElementById('opponent').value || 'unknown';
    
    // Get current date and hour for filename (format: YYYYMMDD-HH)
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

    const filename = `volleyball-stats-G${gameNumber}-vs${opponent.replace(/ /g,'-')}-${formattedDateTime}.json`;
    
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function resetBoard() {
    scores = { home: 0, away: 0 };
    currentSet = 1;
    document.getElementById('homeScore').textContent = '0';
    document.getElementById('awayScore').textContent = '0';
    document.getElementById('setNumber').textContent = '1';
    document.querySelectorAll('.stat span:nth-child(3)').forEach(span => {
        span.textContent = '0';
    });
    dataStream.length = 0;
    allSetsData = {};
    updateSetSelector();
    generateStatsTable();
}

function resetScores() {
    scores = { home: 0, away: 0 };
    document.getElementById('homeScore').textContent = '0';
    document.getElementById('awayScore').textContent = '0';
    logScoreReset();
}

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
    
    // Append Team Stats panel as a player box
    const teamDiv = document.createElement('div');
    teamDiv.className = 'player team-stats';
    teamDiv.innerHTML = `<h2>Team Stats</h2>
        <div class="stat">
    <span>Aced:</span>
    <button onclick="updateStat('team', 'Aced', -1)">-</button>
    <span id="team-Aced">0</span>
    <button onclick="updateStat('team', 'Aced', 1)">+</button>
</div>
<div class="stat">
    <span>Missed Serves:</span>
    <button onclick="updateStat('team', 'Missed Serves', -1)">-</button>
    <span id="team-Missed Serves">0</span>
    <button onclick="updateStat('team', 'Missed Serves', 1)">+</button>
</div>
<div class="stat">
    <span>No-Touch Point:</span>
    <button onclick="updateStat('team', 'No-Touch Point', -1)">-</button>
    <span id="team-No-Touch Point">0</span>
    <button onclick="updateStat('team', 'No-Touch Point', 1)">+</button>
</div>
<div class="stat">
    <span>Technical Error:</span>
    <button onclick="updateStat('team', 'Technical Error', -1)">-</button>
    <span id="team-Technical Error">0</span>
    <button onclick="updateStat('team', 'Technical Error', 1)">+</button>
</div>`;
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
    const element = document.getElementById(`${playerId}-${statName}`);
    const newValue = Math.max(parseInt(element.textContent) + change, 0);
    element.textContent = newValue;

    // Ensure that team stats are properly logged in the dataStream
    dataStream.push({
        timestamp: new Date().toISOString(),
        player: playerId,
        stat: statName,
        change: change,
        newValue: newValue
    });

    generateStatsTable(); // Refresh the table with updated values
}
