// its on server

function updateDiscordRPC() {
    if (window.parent) {
        const titleEl = document.getElementById('currentSongTitle');
        const artistEl = document.getElementById('currentSongArtist');

        if (!titleEl || !artistEl) return;

        window.parent.postMessage({
            type: 'track-changed',
            title: titleEl.textContent,
            artist: artistEl.textContent
        }, '*');
    }
}

function pauseDiscordRPC() {
    if (window.parent) {
        window.parent.postMessage({ type: 'track-paused' }, '*');
    }
}

const audioPlayer = document.getElementById('audioPlayer');
const playlist = document.getElementById('playlist');

audioPlayer.addEventListener('play', updateDiscordRPC);
audioPlayer.addEventListener('pause', pauseDiscordRPC);
playlist.addEventListener('click', updateDiscordRPC);
audioPlayer.addEventListener('ended', updateDiscordRPC);

setInterval(updateDiscordRPC, 10000);