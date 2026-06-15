const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    updateTrack: (trackInfo) => ipcRenderer.send('track-changed', trackInfo)
});

window.addEventListener('message', (event) => {
    if (!event.data.type) return;

    if (event.data.type === 'track-changed') {
        window.electronAPI.updateTrack({
            title: event.data.title,
            artist: event.data.artist,
            isPlaying: true
        });
    } else if (event.data.type === 'track-paused') {
        window.electronAPI.updateTrack({
            isPlaying: false
        });
    }
});
