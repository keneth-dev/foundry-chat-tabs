let activeTab = 'dialogue';
let activeNotification = null; // Change to collection if more tabs are added.

// Override Foundry's default scrollBottom function to account for some messages being hidden.
ChatLog.prototype.scrollBottom = async function ({popout=false, waitImages=false, scrollOptions={}}={}) {
    if ( !this.rendered ) return;
    if ( waitImages ) await this._waitForImages();

    const log = this.element[0].querySelector("#chat-log");
    // Finds the last visible chat message in the current chat log and scrolls to it.
    $(log).find('.chat-message:visible:last')[0]?.scrollIntoView(scrollOptions);
    if ( popout ) this._popout?.scrollBottom({waitImages, scrollOptions});
}

function getMessageType(message) {
    // TODO: It should be possible to externalize this logic.
    if (message.isRoll || message.style === CONST.CHAT_MESSAGE_STYLES.OTHER) {
        return 'rolls';
    }

    return 'dialogue';
}

// Checks if the message is visible.
function isMessageVisible(message) {
    // Message is not visible to the current User.
    if (!message.visible) {
        return false;
    }

    return activeTab === getMessageType(message);
}

// Sets message visibility by its message id.
function setVisibility(id, visible) {
    const el = $(`.chat-message[data-message-id=${id}]`);

    if (visible) {
        el.show();
    } else {
        el.hide();
    }
}

function notify(tab) {
    $(`.chat-tabs .${tab}-notification`).show();
    activeNotification = tab;
}

Hooks.on('renderChatLog', async function (chatLog, html, data) {
    const prependTabs = `
    <nav class="tabs chat-tabs" data-group="chat-tabs">
        <a class="item" data-tab="dialogue" data-group="chat-tabs">${game.i18n.localize("chat-tabs.tabs.dialogue")}</a>
        <i class="notification-pip fas fa-exclamation-circle dialogue-notification"></i>
        <a class="item" data-tab="rolls" data-group="chat-tabs">${game.i18n.localize("chat-tabs.tabs.rolls")}</a>
        <i class="notification-pip fas fa-exclamation-circle rolls-notification"></i>
    </nav>
    `;
    html.find('#chat-log').before(prependTabs);

    const tabs = new Tabs({
        navSelector: '.tabs',
        contentSelector: '.content',
        initial: activeTab,
        callback: function (event, html, tab) {
            activeTab = tab;

            // Makes sure that active tab is the same on both.
            // The false parameter prevents a second callback from triggering.
            if (window.game.chatTabs.popout) {
                window.game.chatTabs.popout.activate(tab, false);
            }
            if (window.game.chatTabs.sidebar) {
                window.game.chatTabs.sidebar.activate(tab, false);
            }

            // Hide notification for active tab.
            setTimeout(() => $(`.chat-tabs .${activeTab}-notification`).hide(), 500);
            activeNotification = null;

            for (const message of chatLog.collection) {
                setVisibility(message.id, isMessageVisible(message));
            }

            chatLog.scrollBottom({
                popout: true,
                waitImages: true,
            });
        }
    });
    tabs.bind(html[0]);

    if (chatLog.popOut) {
        window.game.chatTabs.popout = tabs;
    } else {
        window.game.chatTabs.sidebar = tabs;
    }

    chatLog.scrollBottom({
        popout: true,
        waitImages: true,
    });

    // Move the dialogue notification icon to the correct position on its tab.
    $('.chat-tabs .dialogue-notification').css('right', function (v) { return $(this).parent().width() / 2 + 2; });

    // Render any active notifications.
    if (activeNotification) {
        notify(activeNotification);
    }
});

Hooks.on('renderChatMessage', async function (chatMessage, html, data) {
    if (!isMessageVisible(chatMessage)) {
        html.hide();
    } else {
        html.show();
    }
});

Hooks.on('createChatMessage', async function (chatMessage, options, userId) {
    const type = getMessageType(chatMessage);

    // If message should be visible on a different tab, show notification pip.
    if (chatMessage.visible && activeTab !== type) {
        notify(type);
    }
});

Hooks.on('diceSoNiceRollComplete', (id) => {
    if (activeTab !== 'rolls') {
        setVisibility(id, false);
    }
});

Hooks.on('init', () => {
    window.game.chatTabs = {};

    // TODO: Add any necessary configuration.
})