const chat_history = document.querySelector("#chat-messages");
const feature_message = document.querySelector("#show-message");

// Create WebSocket connection.
let socket = new WebSocket("ws://127.0.0.2:1350/chat.ws");
const reconnect = () => {
    // check if socket is connected
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        return true;
    }
    // attempt to connect
    socket = new WebSocket("ws://127.0.0.2:1350/chat.ws");
    bindWebsocketEvents(socket);
};

// Connection opened
const bindWebsocketEvents = () => {
    socket.addEventListener("open", (event) => {
        console.log("[SNEED] Connection established.");
    });

    // Listen for messages
    socket.addEventListener("message", (event) => {
        const data = JSON.parse(event.data);
        const message = JSON.parse(data.message);
        switch (data.tag) {
            case "chat_message":
                handle_message(message);
                break;
            case "feature_message":
                handle_feature_message(message);
                break;
            case "viewers":
                handle_viewers(message);
                break;
            default:
                console.log("Unknown tag:", message.tag);
                break;

        }
    });

    socket.addEventListener("close", (event) => {
        console.log("[SNEED] Socket has closed. Attempting reconnect.", event.reason);
        setTimeout(function () { reconnect(); }, 1000);
    });

    socket.addEventListener("error", (event) => {
        socket.close();
        setTimeout(function () { reconnect(); }, 1000);
    });
};

bindWebsocketEvents(socket);

function handle_emote(node, message) {
    const innerEl = node.getElementsByClassName("msg-text")[0];
    let allImages = false;

    innerEl.children.forEach(el => {
        if (el.tagName !== "IMG") {
            allImages = false;
            return false;
        }
    });

    if (allImages) {
        node.classList.add("msg--emote");
    }


}

function handle_feature_message(id) {
    // Check if message is a set or unset.
    if (id === null) {
        feature_message.innerHTML = "";
    }
    else {
        let el = document.getElementById(id);
        if (el !== null) {
            let fel = el.cloneNode(true);
            fel.id = `feature-${id}`;
            feature_message.innerHTML = fel.outerHTML;
            console.log("SET!!!");
        }
        else {
            console.log("Featured chat message not found:", id);
        }
    }
}

function handle_message(message) {
    // check if element already exists
    const existingEl = document.getElementById(message.id);
    if (existingEl !== null) {
        return existingEl;
    }

    // check if message is a command
    if (handle_command(message)) {
        // consume message if it is a command.
        return null;
    }

    // create message el
    let el = document.createElement("div");
    chat_history.appendChild(el);
    el.outerHTML = message.html;
    el = document.getElementById(message.id);

    // apply premium style
    if (message.amount > 0)
        handle_premium(el, message);
    // crush standard emote replies
    //else
    //    handle_emote(el, message);

    // remove first old message that is not sticky.
    while (chat_history.children.length > 1000) {
        for (let i = 0; i < chat_history.children.length; i++) {
            if (!chat_history.childNodes[i].classList.contains("msg--sticky")) {
                chat_history.childNodes[i].remove();
                break;
            }
        }
    }
}

function handle_premium(node, message) {
    if (message.currency == 'USD') {
        node.classList.add("msg--sticky");
        recalculate_premium_positions();

        // 6 seconds for every dollar, 10 minutes for $100, caps 10 minutes.
        let time = Math.min(600, message.amount * 6);
        //console.log(message.amount, time);
        setTimeout(() => {
            node.classList.remove("msg--sticky");
            recalculate_premium_positions();
        }, time * 1000);
    }
}

window.livestream_viewers = {};
function handle_viewers(message) {
    let total = 0;
    console.log("VIEWERS", message);

    for (const [key, value] of Object.entries(message)) {
        window.livestream_viewers[key] = parseInt(value, 10);
    }

    for (const [key, value] of Object.entries(window.livestream_viewers)) {
        total += value;
    }

    total = Math.max(total, 0);
    document.getElementById("live-totals").innerHTML = total;
}

function recalculate_premium_positions() {
    let premium_messages = document.getElementsByClassName("msg--sticky");
    let top = 5;
    for (let i = 0; i < premium_messages.length; i++) {
        top += premium_messages[i].offsetHeight + 5;
    }

    let space = document.body.scrollHeight / 2;
    if (top > space) {
        console.log(space, top, space - top);
        top = space - top;
    }
    else {
        top = 5;
    }

    for (let i = 0; i < premium_messages.length; i++) {
        premium_messages[i].style.top = `${top}px`;
        top += premium_messages[i].scrollHeight + 5;
    }
}

//
// Polls
//

var active_poll = null;
const poll_ui = document.getElementById("poll-ui");
const superchat_ui = document.getElementById("superchat-ui");

class poll {
    constructor(question, multi_vote, options) {
        this.question = question;
        this.options = options;
        this.votes = [];
        this.voters = [];
        this.multi_vote = multi_vote;
        this.total_votes = 0;

        for (let i = 0; i < this.options.length; i++) {
            this.votes.push(0);
        }

        this.update();
        poll_ui.style.display = "block";
        poll_ui.classList.remove("fade-out");
        poll_ui.classList.add("fade-in");
        superchat_ui.classList.add("slide-down");
    }

    end_poll() {
        let participants = this.voters.length;
        let html = `<strong>${this.question}</strong><br><small>${participants} participants</small><ul>`;
        let winning_option = 0;

        for (let i = 0; i < this.options.length; i++) {
            if (this.votes[i] > this.votes[winning_option])
                winning_option = i;
        }

        for (let i = 0; i < this.options.length; i++) {
            let percentage = 0;
            if (this.total_votes > 0) {
                percentage = (this.votes[i] / this.total_votes) * 100;
                percentage = percentage.toFixed(2);
            }
            if (i == winning_option)
                html += `<li><strong>!vote ${i + 1}: ${this.options[i]} - ${this.votes[i]} (${percentage}%)</strong></li>`;
            else
                html += `<li>!vote ${i + 1}: ${this.options[i]} - ${this.votes[i]} (${percentage}%)</li>`;
        }

        poll_ui.innerHTML = html;

        setTimeout(() => {
            poll_ui.classList.remove("fade-in");
            poll_ui.classList.add("fade-out");
            setTimeout(() => { poll_ui.style.display = "none"; }, 500);
        }, 10000);
        active_poll = null;
    }

    update() {
        let participants = this.voters.length;
        let html = `<strong>${this.question}</strong><br><small>${participants} participants</small><ul>`;
        for (let i = 0; i < this.options.length; i++) {
            let percentage = 0;
            if (this.total_votes > 0) {
                percentage = (this.votes[i] / this.total_votes) * 100;
                percentage = percentage.toFixed(2);
            }
            html += `<li>!vote ${i + 1}: ${this.options[i]} - ${this.votes[i]} (${percentage}%)</li>`;
        }

        html += "</ul><small>use !vote [number] to vote</small>";

        poll_ui.innerHTML = html;
    }

    handle_vote_message(data) {
        // check if user has already voted
        if (active_poll.voters.includes(data.username))
            return;

        let args = data.message.replace("!vote", "").replace("!", "").trim();
        let result = false;
        if (this.multi_vote) {
            let votes = args.split(" ");
            // remove duplicates
            votes = [...new Set(votes)];

            for (let i = 0; i < votes.length; i++)
                result |= this.handle_vote(votes[i]);
        } else {
            result = this.handle_vote(args);
        }

        if (result) {
            this.voters.push(data.username);
            this.update();
        }
    }

    handle_vote(vote_index) {
        if (isNaN(vote_index))
            return false;

        let i = parseInt(vote_index) - 1;

        if (i < 0 || i >= this.options.length)
            return false;

        this.votes[i]++;
        this.total_votes++;
        return true;
    }

    is_valid_vote(message) {
        // Allow "!vote 1"
        if (message.startsWith("!vote"))
            return true;
        // Allow "1"
        if (message.length == 1 && !isNaN(message[0]))
            return true;
        // Allow "!2"
        if (message.startsWith("!") && !isNaN(message[1]))
            return true;
        return false;
    }
}

function handle_command(message) {
    function unescape(escapedStr) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = escapedStr;
        return tempDiv.textContent || tempDiv.innerText || "";
    }

    // ignore non-commands, except if a vote is running so we can allow messages like "1" or "!2" to be counted as votes
    if (!message.message.startsWith("!") && active_poll === null)
        return false;

    // html escape codes use semicolons, so we need to unescape them otherwise the splitting will break
    let msg = unescape(message.message);
    const is_admin = message.is_owner;

    if (msg.startsWith("!poll") && is_admin) {
        msg = msg.replace("!poll", "").trim();
        let parts = msg.split(";");
        parts = parts.filter(el => el.length != 0);
        if (parts.length >= 3)
            active_poll = new poll(parts[0], false, parts.slice(1));
        return true;
    }
    else if (msg.startsWith("!multipoll") && is_admin) {
        msg = msg.replace("!multipoll", "").trim();
        let parts = msg.split(";");
        parts = parts.filter(el => el.length != 0);
        if (parts.length >= 3)
            active_poll = new poll(parts[0], true, parts.slice(1));
        return true;
    }
    else if (msg.startsWith("!endpoll") && is_admin) {
        if (active_poll !== null)
            active_poll.end_poll();
        return true;
    }
    else if (active_poll !== null && active_poll.is_valid_vote(message.message)) {
        active_poll.handle_vote_message(message);
        return true;
    }

    return false;
}

function set_date(dateObj) {
    const day = dateObj.getDate();
    const month = dateObj.toLocaleString("default", { month: "long" });
    const year = dateObj.getFullYear();

    const nthNumber = (number) => {
        if (number > 3 && number < 21) return "th";
        switch (number % 10) {
            case 1:
                return "st";
            case 2:
                return "nd";
            case 3:
                return "rd";
            default:
                return "th";
        }
    };

    const date = `${month} ${day}${nthNumber(day)}, ${year}`;
    document.getElementById("date").innerHTML = date;
}
set_date(new Date());
