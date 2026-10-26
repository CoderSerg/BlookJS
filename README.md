# BlookJS

BlookJS is a **client-side** Blooket script that adds an in-page
control panel for game automation, prize information,
and lobby inventory actions.

> **Disclaimer:** BlookJS interacts with Blooket's page runtime and game
> actions. Using third-party scripts may violate Blooket's rules or
> affect other players' experience. Use at your own discretion. Features
> can break when Blooket changes its website.

## Changelog
### v0.13
Additions:
- Cafe support
- Adding commands to README later

## Features

-   Floating, draggable control panel with minimize, restore, and close
    controls
-   Tabs tailored to different Blooket activities
-   Live status section for the current game, stage, prize, and other
    available state
-   Toggle-based automation and manual action buttons
-   Status messages for action results and errors
-   A small minimized pill in the bottom left to reopen the menu
-   `Alt/Option+B` keyboard shortcut to show or hide the panel

## Tabs

### General

General-purpose controls intended to work across game modes.

-   **Random Answer** --- submits a randomly selected answer (answer key not stored on client anymore)
-   **Auto Continue** --- automatically clicks the screen to continue after choosing answer (and also skips the 3 second wrong answer wait!)
-   **Status** --- displays the current game title and whether the
    question has been answered

### Lobby

Tools for the Market and Blooks pages.

-   **Batch Buy** --- buy a specified quantity of a named pack
-   Shows your available token balance, pack price, and estimated total
-   Processes large purchases in batches of up to 100 packs per request
-   Reports how many packs were bought, how many Blooks were opened, how
    many were new, and the remaining tokens
-   **Unlock All (fake)** --- displays unowned Blooks as unlocked
    locally; this is display-only and does not grant ownership on the
    server
-   **Sell Duplicates** --- sells extra copies while keeping one copy of
    each Blook
-   **Sell Commons** --- sells all Common Blooks
-   **Sell Uncommons and Below** --- sells Common and Uncommon Blooks
-   Protects high rarities when
    selling duplicates
-   Requires a second click within six seconds to confirm a bulk-selling
    action (protection)

### Gold Quest

Prize information and automation for Gold Quest.

-   **Reveal Contents** --- displays the pending prize on the pumpkin
    choices
-   **Skip Prize** --- attempts to move past the current prize
-   **Claim Prize** --- reveals and claims a prize
-   **Auto Reveal** --- displays prize information on the pumpkins
-   **Auto Skip** --- automatically skips losing outcomes and "Nothing"
    prizes
-   **Auto Prize** --- automatically selects and claims a prize
-   **Dual Mode** --- combines Auto Skip and Auto Prize
-   **Status** --- shows the current stage, pending prize, and Gold
    score

### Crypto Hack

Prize and hack-stage helpers for Crypto Hack.

-   **Reveal Contents** --- displays the current prize
-   **Skip Prize** --- attempts to skip the current prize
-   **Claim Prize** --- claims the current prize
-   **Skip Hack** --- sends a claim request configured to skip the hack
-   **Auto Reveal** --- displays prize information on the boxes
-   **Auto Skip** --- automatically skips configured prize types
-   **Auto Prize** --- automatically claims prizes
-   **Dual Mode** --- combines Auto Skip and Auto Prize
-   **Status** --- shows the stage, prize, Crypto score, hack target,
    and remaining password options
-   **Hack hints** --- tracks incorrect guesses for a target and lists
    password options that have not been eliminated
-   **Password guessing** --- supports selecting a password option or
    using the first remaining hint

### Fishing Frenzy

Fishing automation and catch information.

-   **Reveal Contents** --- shows the next catch when available, or
    lists the top five estimated catches by odds
-   **Cast / Reel** --- attempts the action appropriate to the current
    fishing stage
-   **Claim Prize** --- attempts to claim the current catch
-   **Auto Fish** --- automates casting, reeling, and claiming
-   **Auto Reveal** --- shows the next online catch and its rarity when
    available
-   **Auto Skip** --- hides on-screen distractions in online fishing
-   **Dual Mode** --- combines Auto Fish and Auto Skip
-   **Remove time limit** --- removes the start-screen 30-minute maximum
    while enabled
-   **Status** --- displays the fishing stage, catch, and weight when
    available
-   **Catch odds** --- includes an internal odds table for multiple lure
    levels

## Panel controls

-   **Drag:** move the menu by dragging its header
-   **Minimize:** collapse the menu into the BlookJS pill
-   **Restore:** click the pill to reopen the menu
-   **Close:** remove the menu completely and stop all BlookJS hacks (or ***APIs***)
-   **Toggle visibility:** press `Alt+B`

The menu automatically selects a tab based on the current page or game
title when it starts.

## Installation and usage

BlookJS is supplied as a JavaScript snippet. The provided source does
not include a browser extension manifest, userscript metadata, or a
standalone installer, so installation depends on how you choose to load
the script.

1.  Open Blooket and navigate to the relevant game or page.
2.  Run the BlookJS script in the environment you use to load the
    snippet. (userscript, console, bookmarklet, etc.)
3.  Use the menu tabs to access the features available for the current
    page.
4.  Check the status area for feedback if an action cannot run.

Some actions require the relevant page to be open first. For example,
batch buying requires the Market page, selling and fake unlock require
the Blooks page, and game-specific features require the matching game
state to be available.

## Important notes

-   **Fake unlock is visual only.** It does not change server-side
    ownership. (just like show it to your friends or something idk)
-   Batch purchases check the displayed token balance and pack cost
    before buying.
-   Bulk selling asks for a second click within six seconds before it
    proceeds.
-   Some actions depend on Blooket's internal React state, message
    handlers, and page runtime. Website updates can make these features
    stop working.
-   The script does not include a separate backend or persistent
    settings store in the supplied source.
-   Use responsibly and follow the rules th- *blah blah blah nobody cares, use hacks however you like*

## Technical overview

-   **Language:** JavaScript
-   **Interface:** DOM-based floating panel using Shadow DOM for UI
    isolation
-   **Game integration:** reads page state and uses available game
    callbacks/messages
-   **Automation loop:** starts only while one or more automation
    options are enabled
-   **Cleanup:** closing the panel calls the script's destroy routine to
    remove its listeners, timers, and UI
-   **API:** oh yeah, this also comes with an API like BlookJS.quest or BlookJS.crypto, menu is just that with buttons

## Contributing

Just open a pull request
Yeah that's it

Pull requests have to be detailed and explain what was changed, removed, improved, or added.

## Project status
### Work In Progress

The script is known as **BlookJS**. Feature
availability depends on the current Blooket page and game state.
