(() => {
  if (window.BlookJS && typeof window.BlookJS.destroy === "function") window.BlookJS.destroy();

  const CHOICE_SELECTOR = '[class*="_choiceInside_"]';
  const HACK_BUTTON_SELECTOR = '[class*="_buttonContainer_"] [class*="_button_"]';
  const PUMPKIN_SELECTOR = '[class*="_choice1_"], [class*="_choice2_"], [class*="_choice3_"]';
  const wrongGuesses = new Map();
  const flags = { skip: false, prize: false, random: false };
  const timers = { attach: null, loop: null, refresh: null };
  let observer = null;
  let menuHost = null;
  let refreshMenu = () => {};
  let removeKeyHandler = () => {};
  let attachedRoom = null;
  let cachedCtx = null;
  let cachedAt = 0;
  let selfCache = null;
  let lastPrize = null;
  let lastHackOptions = null;
  let lastGuess = null;
  let auto = false;
  let questAuto = false;
  let prizeDelay = 450;
  let prizeAttempt = null;
  let cryptoAttempt = null;
  let cryptoFresh = false;
  let wasPrizeStage = false;
  let removeHackClick = () => {};
  let cryptoSkipTypes = ["hack"];
  const cflags = { skip: false, prize: false };
  const GUESS_WAIT = 4500;
  let answered = null;
  let advancedKey = null;
  let lastAnswerScan = 0;

  const prizeTable = [
    { type: "gold", val: 10, text: "+ 10 Candy" },
    { type: "gold", val: 20, text: "+ 20 Candy" },
    { type: "gold", val: 30, text: "+ 30 Candy" },
    { type: "gold", val: 40, text: "+ 40 Candy" },
    { type: "gold", val: 50, text: "+ 50 Candy" },
    { type: "gold", val: 100, text: "+ 100 Candy" },
    { type: "multiply", val: 2, text: "Double Candy!", blook: "Mummy" },
    { type: "multiply", val: 3, text: "Triple Candy!", blook: "Werewolf" },
    { type: "give", val: 0.1, text: "Lose 10% to the King", blook: "Zombie" },
    { type: "give", val: 0.25, text: "Lose 25% to the King", blook: "Vampire Bat" },
    { type: "jackpot", text: "Pumpkin King's Treasure!", blook: "goldKing" },
    { type: "swap", text: "SWAP!", blook: "Ghost" },
    { type: "take", val: 0.1, text: "Take 10%", blook: "Frankenstein" },
    { type: "take", val: 0.25, text: "Take 25%", blook: "Vampire" },
    { type: "nothing", text: "Nothing!", blook: "Pumpkin" },
  ];

  const walk = visit => {
    const root = document.getElementById("root");
    if (!root) return;
    const key = Object.keys(root).find(k => k.startsWith("__reactContainer$"));
    if (!key) return;
    const stack = [root[key]];
    while (stack.length) {
      const fiber = stack.pop();
      if (visit(fiber.memoizedProps)) return;
      if (fiber.sibling) stack.push(fiber.sibling);
      if (fiber.child) stack.push(fiber.child);
    }
  };

  const findContext = () => {
    let found = null;
    let fallback = null;
    walk(props => {
      const value = props && props.value;
      if (value && value.room && typeof value.send === "function") {
        if (value.userId) {
          found = value;
          return true;
        }
        if (!fallback) fallback = value;
      }
      return false;
    });
    return found || fallback;
  };

  const getCtx = () => {
    const now = Date.now();
    if (cachedCtx && now - cachedAt < 1500) return cachedCtx;
    cachedCtx = findContext();
    cachedAt = now;
    return cachedCtx;
  };

  const send = (type, payload) => {
    const ctx = getCtx();
    if (!ctx) return false;
    ctx.send(type, payload);
    return true;
  };

  const plain = value => (value && typeof value.toJSON === "function" ? value.toJSON() : value);

  const stageIs = (player, name) => Boolean(player) && String(player.stage || "").toLowerCase() === name;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  const hackButtons = () => [...document.querySelectorAll(HACK_BUTTON_SELECTOR)];

  const me = () => {
    const ctx = getCtx();
    if (!ctx) return null;
    if (selfCache && selfCache.room === ctx.room && selfCache.player.sessionId === ctx.room.sessionId) {
      return selfCache.player;
    }
    const players = ctx.room.state.players;
    let player = ctx.userId ? players.get(ctx.userId) : null;
    if (!player) {
      players.forEach(p => {
        if (!player && p.sessionId && p.sessionId === ctx.room.sessionId) player = p;
      });
    }
    selfCache = player ? { room: ctx.room, player } : null;
    return player || null;
  };

  const allPlayers = () => {
    const ctx = getCtx();
    const out = {};
    if (ctx) ctx.room.state.players.forEach((p, id) => (out[id] = plain(p)));
    return out;
  };

  const paint = prize => {
    const text = String(prize.text ?? prize.type ?? "");
    document.querySelectorAll(CHOICE_SELECTOR).forEach(el => {
      if (el.textContent !== text) el.textContent = text;
    });
  };

  const entryFor = index => {
    if (typeof index !== "number") return null;
    return { index, ...(prizeTable[index] || { type: "unknown", text: "Unknown (" + index + ")" }) };
  };

  const questPrize = () => {
    const player = me();
    return player ? entryFor(player.pendingPrizeIndex) : null;
  };

  const paintQuest = prize => {
    const text = prize.text.replace(/\n/g, " ");
    document.querySelectorAll(PUMPKIN_SELECTOR).forEach(el => {
      let tag = el.querySelector("[data-blookjs]");
      if (!tag) {
        if (getComputedStyle(el).position === "static") el.style.position = "relative";
        tag = document.createElement("div");
        tag.setAttribute("data-blookjs", "");
        Object.assign(tag.style, {
          position: "absolute",
          left: "0",
          right: "0",
          bottom: "0",
          padding: "6px 14px",
          background: "#18181b",
          color: "#fafafa",
          borderRadius: "12px",
          fontFamily: "'Nunito', system-ui, sans-serif",
          fontWeight: "700",
          fontSize: "14px",
          textAlign: "center",
          pointerEvents: "none",
          zIndex: "5",
        });
        el.appendChild(tag);
      }
      if (tag.textContent !== text) tag.textContent = text;
    });
  };

  const skipPrize = (force = false) => {
    const prize = questPrize();
    const player = me();
    if (!prize || !player) return Promise.resolve({ sent: false, reason: "no pending prize" });
    if (player.stage !== "prize") return Promise.resolve({ sent: false, reason: "not on prize stage", prize });
    if (!force && prize.type !== "give") return Promise.resolve({ sent: false, reason: "prize is not a loss", prize });
    const stageBefore = player.stage;
    const sent = send("playerGetNewQuestion", {});
    return new Promise(resolve => {
      setTimeout(() => {
        const after = me();
        const stageAfter = after ? after.stage : null;
        resolve({ sent, prize, stageBefore, stageAfter, worked: stageAfter !== stageBefore });
      }, 800);
    });
  };

  const pickPrize = () => {
    const player = me();
    if (!player) return Promise.resolve({ sent: false, reason: "not in a game" });
    if (player.stage !== "prize") return Promise.resolve({ sent: false, reason: "not on prize stage" });
    const prize = questPrize();
    if (!send("revealPrize", {})) return Promise.resolve({ sent: false, reason: "not in a game" });
    return new Promise(resolve => {
      setTimeout(() => {
        const sent = send("claimPrize", {});
        resolve({ sent, prize, reason: sent ? undefined : "not in a game" });
      }, prizeDelay);
    });
  };

  const readQuestion = () => {
    let props = null;
    walk(p => {
      if (p && Array.isArray(p.questions) && typeof p.sendAnswer === "function") {
        props = p;
        return true;
      }
      return false;
    });
    if (!props) return null;
    const index = typeof props.currentIndex === "number" ? props.currentIndex : props.questions.length - 1;
    const question = props.questions[index];
    if (!question) return null;
    const choices = Array.isArray(question.answers) ? question.answers.map(String) : [];
    const done = Boolean(props.feedbacks && props.feedbacks[index]);
    return { props, index, question, choices, done };
  };

  const randomAnswerTick = () => {
    const now = Date.now();
    if (now - lastAnswerScan < 120) return;
    lastAnswerScan = now;
    const info = readQuestion();
    if (!info) {
      answered = null;
      advancedKey = null;
      return;
    }
    const key = info.index + ":" + (info.question.number ?? "") + ":" + info.question.text;
    if (info.done) {
      answered = null;
      const feedback = info.props.feedbacks[info.index];
      if (feedback && feedback.isCorrect === false && typeof info.props.sendAnswerNext === "function" && advancedKey !== key) {
        advancedKey = key;
        const wait = (Number(feedback.incorrectTime) || 0) * 1000 + 150;
        setTimeout(() => info.props.sendAnswerNext(), wait);
      }
      return;
    }
    advancedKey = null;
    if (!info.choices.length) return;
    if (answered && answered.key === key && now - answered.at < 3000) return;
    answered = { key, at: now };
    info.props.sendAnswer(info.choices[Math.floor(Math.random() * info.choices.length)]);
  };

  const claimCryptoPrize = () => {
    const player = me();
    if (!player) return { sent: false, reason: "not in a game" };
    if (!lastPrize) return { sent: false, reason: "no prize yet" };
    if (player.defensiveHackType) return { sent: false, reason: "you are being hacked" };
    const prize = lastPrize;
    const skipHack = prize.type === "hack";
    const sent = send("claimPrize", { skipHack });
    if (sent) cryptoFresh = false;
    return { sent, prize, skipHack, reason: sent ? undefined : "not in a game" };
  };

  const skipCryptoPrize = (force = false) => {
    const player = me();
    if (!player || !lastPrize) return Promise.resolve({ sent: false, reason: "no pending prize" });
    if (!stageIs(player, "prize")) return Promise.resolve({ sent: false, reason: "not on prize stage", prize: lastPrize });
    if (!force && !cryptoSkipTypes.includes(lastPrize.type)) {
      return Promise.resolve({ sent: false, reason: "prize type not in skip list", prize: lastPrize });
    }
    const prize = lastPrize;
    const stageBefore = player.stage;
    const sent = send("playerGetNewQuestion", {});
    if (sent) cryptoFresh = false;
    return new Promise(resolve => {
      setTimeout(() => {
        const after = me();
        const stageAfter = after ? after.stage : null;
        resolve({ sent, prize, stageBefore, stageAfter, worked: stageAfter !== stageBefore });
      }, 800);
    });
  };

  const guessPassword = async choice => {
    const player = me();
    if (!player) return { sent: false, reason: "not in a game" };
    if (player.stage && !/hack/i.test(String(player.stage))) return { sent: false, reason: "not on the hack stage" };
    if (!lastHackOptions || !lastHackOptions.passwordIndexes.length) return { sent: false, reason: "no hack options yet" };
    const ids = lastHackOptions.passwordIndexes;
    let position = -1;
    if (choice === undefined) {
      const hints = api.crypto.hack.hints();
      position = hints && hints.remaining.length ? ids.indexOf(hints.remaining[0]) : 0;
    } else if (Number.isInteger(choice) && choice >= 0 && choice < ids.length) {
      position = choice;
    } else {
      position = ids.indexOf(choice);
    }
    if (position < 0) return { sent: false, reason: "not a valid option", options: ids };
    const index = ids[position];
    lastGuess = { target: lastHackOptions.targetPlayerName, index };
    const first = hackButtons()[position];
    if (first && /_buttonDeactivated_/.test(first.className)) return { sent: false, reason: "already guessed this round" };
    const deadline = Date.now() + GUESS_WAIT;
    while (Date.now() < deadline) {
      const button = hackButtons()[position];
      if (button) {
        button.click();
        await sleep(120);
        const after = hackButtons()[position];
        if (after && /_buttonDeactivated_/.test(after.className)) {
          return { sent: true, via: "ui", index, text: after.textContent };
        }
      }
      await sleep(150);
    }
    return { sent: send("submitPasswordGuess", { passwordIndex: index }), via: "message", index };
  };

  const autoCryptoStage = player => {
    if (!cryptoFresh || !lastPrize) return;
    if (!cflags.skip && !cflags.prize) return;
    if (player.defensiveHackType) return;
    const prize = lastPrize;
    const now = Date.now();
    if (cflags.skip && cryptoSkipTypes.includes(prize.type)) {
      const prev = cryptoAttempt && cryptoAttempt.kind === "skip" ? cryptoAttempt : null;
      if (!prev || (now - prev.at >= 400 && prev.sends < 4)) {
        cryptoAttempt = { kind: "skip", at: now, sends: prev ? prev.sends + 1 : 1 };
        send("playerGetNewQuestion", {});
      }
      return;
    }
    if (!cflags.prize) return;
    const prev = cryptoAttempt && cryptoAttempt.kind === "claim" ? cryptoAttempt : null;
    if (!prev || (now - prev.at >= 2000 && prev.sends < 3)) {
      cryptoAttempt = { kind: "claim", at: now, sends: prev ? prev.sends + 1 : 1 };
      setTimeout(() => {
        if (lastPrize === prize && cryptoFresh) send("claimPrize", { skipHack: prize.type === "hack" });
      }, prizeDelay);
    }
  };

  const autoPrizeStage = player => {
    if (!flags.skip && !flags.prize) return;
    const prize = entryFor(player.pendingPrizeIndex);
    if (!prize) return;
    const now = Date.now();
    if (prize.type === "give") {
      const prev = prizeAttempt && prizeAttempt.kind === "skip" ? prizeAttempt : null;
      if (!prev || (now - prev.at >= 400 && prev.sends < 4)) {
        prizeAttempt = { kind: "skip", at: now, sends: prev ? prev.sends + 1 : 1 };
        send("playerGetNewQuestion", {});
      }
      return;
    }
    if (!flags.prize) return;
    const prev = prizeAttempt && prizeAttempt.kind === "pick" ? prizeAttempt : null;
    if (!prev || (now - prev.at >= 2000 && prev.sends < 3)) {
      prizeAttempt = { kind: "pick", at: now, sends: prev ? prev.sends + 1 : 1 };
      send("revealPrize", {});
      setTimeout(() => send("claimPrize", {}), prizeDelay);
    }
  };

  const tickAuto = () => {
    const player = me();
    if (!player) return;
    if (player.stage !== "prize") prizeAttempt = null;
    else autoPrizeStage(player);
    const inPrize = stageIs(player, "prize");
    if (wasPrizeStage && !inPrize) {
      cryptoFresh = false;
      cryptoAttempt = null;
    }
    wasPrizeStage = inPrize;
    if (inPrize) autoCryptoStage(player);
    if (flags.random) randomAnswerTick();
  };

  const syncLoop = () => {
    const needed = flags.skip || flags.prize || flags.random || cflags.skip || cflags.prize;
    if (!flags.random) {
      answered = null;
      advancedKey = null;
    }
    if (needed && !timers.loop) timers.loop = setInterval(tickAuto, 25);
    if (!needed && timers.loop) {
      clearInterval(timers.loop);
      timers.loop = null;
      prizeAttempt = null;
      cryptoAttempt = null;
    }
  };

  const setFlag = (name, enabled) => {
    flags[name] = Boolean(enabled);
    syncLoop();
    return flags[name];
  };

  const setCryptoFlag = (name, enabled) => {
    cflags[name] = Boolean(enabled);
    syncLoop();
    return cflags[name];
  };

  const cryptoStatus = () => ({ reveal: auto, skip: cflags.skip, prize: cflags.prize, random: flags.random });

  const handlePrize = prize => {
    lastPrize = prize;
    cryptoFresh = true;
    cryptoAttempt = null;
    if (auto) paint(prize);
  };

  const handleHackOptions = options => {
    lastHackOptions = options;
  };

  const handleGuessResult = result => {
    if (lastGuess && result && result.correct === false && !result.interrupted) {
      const known = wrongGuesses.get(lastGuess.target) || new Set();
      known.add(lastGuess.index);
      wrongGuesses.set(lastGuess.target, known);
    }
  };

  const attach = () => {
    const ctx = getCtx();
    if (!ctx || ctx.room === attachedRoom) return;
    attachedRoom = ctx.room;
    ctx.room.onMessage("prizeSelected", handlePrize);
    ctx.room.onMessage("hackPasswordOptions", handleHackOptions);
    ctx.room.onMessage("passwordGuessResult", handleGuessResult);
    try {
      if (typeof ctx.room.onStateChange === "function") {
        ctx.room.onStateChange(() => {
          if (timers.loop) tickAuto();
        });
      }
    } catch (error) {
      return;
    }
  };

  const questStatus = () => ({ reveal: questAuto, skip: flags.skip, prize: flags.prize, random: flags.random });

  const setQuestReveal = enabled => {
    questAuto = Boolean(enabled);
    const prize = questAuto ? questPrize() : null;
    if (prize) paintQuest(prize);
    return questAuto;
  };

  const api = {
    version: "0.6.1",
    crypto: {
      getPrize: () => lastPrize,
      reveal: () => {
        if (lastPrize) paint(lastPrize);
        return lastPrize;
      },
      autoReveal: (enabled = true) => {
        auto = Boolean(enabled);
        if (auto && lastPrize) paint(lastPrize);
        return auto;
      },
      claimPrize: (skipHack = false) => send("claimPrize", { skipHack }),
      claim: claimCryptoPrize,
      skipPrize: skipCryptoPrize,
      getStage: () => {
        const player = me();
        return player ? player.stage : null;
      },
      autoSkip: (enabled = true, types) => {
        if (Array.isArray(types)) cryptoSkipTypes = types.map(String);
        return setCryptoFlag("skip", enabled);
      },
      autoPrize: (enabled = true, delayMs) => {
        if (typeof delayMs === "number") prizeDelay = Math.max(0, delayMs);
        return setCryptoFlag("prize", enabled);
      },
      randomAnswer: (enabled = true) => setFlag("random", enabled),
      dualMode: (enabled = true) => {
        const on = Boolean(enabled);
        auto = on;
        if (on && lastPrize) paint(lastPrize);
        cflags.skip = on;
        cflags.prize = on;
        syncLoop();
        return cryptoStatus();
      },
      status: cryptoStatus,
      getCrypto: () => {
        const player = me();
        return player ? player.score : null;
      },
      getSelf: () => plain(me()),
      getPlayers: allPlayers,
      hack: {
        getOptions: () => lastHackOptions,
        options: () => {
          if (!lastHackOptions) return [];
          const buttons = [...document.querySelectorAll(HACK_BUTTON_SELECTOR)];
          return lastHackOptions.passwordIndexes.map((index, i) => ({
            index,
            text: buttons[i] ? buttons[i].textContent : null,
          }));
        },
        hints: () => {
          if (!lastHackOptions) return null;
          const target = lastHackOptions.targetPlayerName;
          const wrong = wrongGuesses.get(target) || new Set();
          return {
            target,
            remaining: lastHackOptions.passwordIndexes.filter(i => !wrong.has(i)),
            eliminated: [...wrong],
          };
        },
        guess: guessPassword,
      },
    },
    quest: {
      prizeTable,
      getPrize: questPrize,
      getOptions: () => {
        const player = me();
        if (!player || !player.prizeOptionsIndices) return [];
        const list = player.prizeOptionsIndices.toArray
          ? player.prizeOptionsIndices.toArray()
          : [...player.prizeOptionsIndices];
        return list.map(entryFor);
      },
      getStage: () => {
        const player = me();
        return player ? player.stage : null;
      },
      reveal: () => {
        const prize = questPrize();
        if (prize) paintQuest(prize);
        return prize;
      },
      autoReveal: (enabled = true) => setQuestReveal(enabled),
      revealPrize: () => send("revealPrize", {}),
      claimPrize: () => send("claimPrize", {}),
      pickPrize,
      skipOption: skipPrize,
      autoSkip: (enabled = true) => setFlag("skip", enabled),
      autoPrize: (enabled = true, delayMs) => {
        if (typeof delayMs === "number") prizeDelay = Math.max(0, delayMs);
        return setFlag("prize", enabled);
      },
      randomAnswer: (enabled = true) => setFlag("random", enabled),
      dualAuto: (enabled = true) => {
        const on = Boolean(enabled);
        setQuestReveal(on);
        setFlag("skip", on);
        return questStatus();
      },
      dualMode: (enabled = true) => {
        const on = Boolean(enabled);
        setQuestReveal(on);
        flags.skip = on;
        flags.prize = on;
        syncLoop();
        return questStatus();
      },
      status: questStatus,
      getGold: () => {
        const player = me();
        return player ? player.score : null;
      },
      getScore: () => {
        const player = me();
        return player ? player.score : null;
      },
      getSelf: () => plain(me()),
      getPlayers: allPlayers,
      targets: () => {
        const ctx = getCtx();
        const self = me();
        const out = [];
        if (!ctx) return out;
        ctx.room.state.players.forEach(p => {
          if (p.sessionId && (!self || p.userID !== self.userID)) {
            out.push({ userId: p.userID, name: p.name, blook: p.blook, score: p.score });
          }
        });
        return out;
      },
      pickTarget: userId => send("swapOrTake", { targetUserId: userId }),
    },
    debug: {
      state: () => plain(me()),
    },
    menu: {
      show: () => menuHost && menuHost.dispatchEvent(new CustomEvent("blookjs-show")),
      hide: () => menuHost && menuHost.dispatchEvent(new CustomEvent("blookjs-hide")),
      toggle: () => menuHost && menuHost.dispatchEvent(new CustomEvent("blookjs-toggle")),
    },
    destroy: () => {
      clearInterval(timers.attach);
      clearInterval(timers.loop);
      clearInterval(timers.refresh);
      timers.loop = null;
      if (observer) observer.disconnect();
      removeKeyHandler();
      removeHackClick();
      if (menuHost) menuHost.remove();
      menuHost = null;
    },
  };

  const MENU_CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: 'Nunito', system-ui, -apple-system, 'Segoe UI', sans-serif; }
    [hidden] { display: none !important; }
    .wrap { position: fixed; right: max(12px, env(safe-area-inset-right)); bottom: max(12px, env(safe-area-inset-bottom)); width: min(340px, calc(100vw - 24px)); z-index: 2147483000; color: #fafafa; }
    .panel { display: flex; flex-direction: column; max-height: calc(100vh - 24px); max-height: calc(100dvh - 24px); background: #18181b; border: 2px solid #27272a; border-radius: 12px; overflow: hidden; }
    .head { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px 8px 16px; background: #0bc2cf; color: #09090b; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
    .title { font-family: 'Titan One', 'Nunito', sans-serif; font-size: 20px; letter-spacing: 0.3px; color: #ffffff; }
    .ver { margin-left: 8px; font-size: 12px; font-weight: 800; color: #ffffff; }
    .icon-btn { display: grid; place-items: center; width: 36px; height: 36px; border: 0; border-radius: 8px; background: #118891; color: #fafafa; cursor: pointer; }
    .tabs { display: flex; border-bottom: 2px solid #27272a; }
    .tab { flex: 1; min-height: 44px; padding: 10px 16px; background: none; border: 0; border-bottom: 3px solid transparent; color: #a1a1aa; font-size: 14px; font-weight: 800; cursor: pointer; }
    .tab[aria-selected="true"] { color: #fafafa; border-bottom-color: #0bc2cf; }
    .body { overflow-y: auto; padding: 0; }
    .section { border-top: 2px solid #27272a; }
    .section:first-child { border-top: 0; }
    .section-head { display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 44px; padding: 10px 16px; background: none; border: 0; color: #fafafa; font-size: 13px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; cursor: pointer; }
    .chev { display: grid; place-items: center; color: #a1a1aa; transition: transform 0.15s; }
    .section-head[aria-expanded="false"] .chev { transform: rotate(-90deg); }
    .section-body { padding-bottom: 6px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 52px; padding: 8px 16px; }
    .label { font-size: 15px; font-weight: 800; }
    .sub { margin-top: 2px; font-size: 12px; font-weight: 600; color: #a1a1aa; }
    .switch { position: relative; flex: none; width: 52px; height: 30px; border: 0; border-radius: 999px; background: #3f3f46; cursor: pointer; transition: background 0.15s; }
    .switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 24px; height: 24px; border-radius: 50%; background: #fafafa; transition: transform 0.15s; }
    .switch[aria-checked="true"] { background: #7fbb43; }
    .switch[aria-checked="true"]::after { transform: translateX(22px); }
    .info { display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; margin: 0; padding: 8px 16px; font-size: 14px; }
    .info dt { font-weight: 700; color: #a1a1aa; }
    .info dd { margin: 0; text-align: right; font-weight: 800; overflow-wrap: anywhere; }
    .good { color: #7fbb43; }
    .bad { color: #dc2626; }
    .warn { color: #ffc000; }
    .muted { color: #a1a1aa; }
    .buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 8px 16px 14px; }
    .btn { min-height: 46px; padding: 10px 16px; border: 0; border-bottom: 4px solid rgba(0, 0, 0, 0.28); border-radius: 8px; font-size: 14px; font-weight: 800; cursor: pointer; }
    .btn:active { transform: translateY(2px); border-bottom-width: 2px; }
    .btn.blue { background: #0bc2cf; color: #09090b; }
    .btn.green { background: #7fbb43; color: #09090b; }
    .btn.yellow { background: #ffc000; color: #09090b; }
    .btn.red { background: #dc2626; color: #fafafa; }
    .btn.purple { background: #9a49aa; color: #fafafa; }
    .status { min-height: 42px; padding: 10px 16px; border-top: 2px solid #27272a; font-size: 13px; font-weight: 700; color: #a1a1aa; }
    .pill { display: none; align-items: center; gap: 8px; min-height: 46px; padding: 10px 18px; border: 0; border-bottom: 4px solid rgba(0, 0, 0, 0.28); border-radius: 10px; background: #0bc2cf; color: #ffffff; font-family: 'Titan One', 'Nunito', sans-serif; font-size: 18px; cursor: pointer; }
    .min .panel { display: none; }
    .min .pill { display: flex; }
  `;

  const ICON_MINUS = '<path d="M5 12h14"/>';
  const ICON_CHEVRON = '<path d="m6 9 6 6 6-6"/>';
  const ICON_ZAP = '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>';

  const svg = (paths, size) =>
    '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + "</svg>";

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const toneFor = type => {
    if (type === "gold" || type === "multiply" || type === "jackpot") return "good";
    if (type === "give" || type === "hack") return "bad";
    if (type === "swap" || type === "take") return "warn";
    return "muted";
  };

  const oneLine = text => String(text).replace(/\s*\n\s*/g, " ");

  const buildMenu = () => {
    const host = document.createElement("div");
    host.id = "blookjs-menu";
    const shadow = host.attachShadow({ mode: "open" });
    const style = el("style");
    style.textContent = MENU_CSS;
    const wrap = el("div", "wrap");
    const panel = el("div", "panel");
    const updaters = [];
    const status = el("div", "status", "Ready");
    status.setAttribute("aria-live", "polite");
    const setStatus = text => {
      status.textContent = text;
    };
    const refresh = () => updaters.forEach(fn => {
      try {
        fn();
      } catch (error) {
        return;
      }
    });

    const head = el("div", "head");
    const titleBox = el("div", "");
    titleBox.append(el("span", "title", "BlookJS"), el("span", "ver", "v" + api.version));
    const minBtn = el("button", "icon-btn");
    minBtn.type = "button";
    minBtn.setAttribute("aria-label", "Minimize");
    minBtn.innerHTML = svg(ICON_MINUS, 18);
    head.append(titleBox, minBtn);

    const pill = el("button", "pill");
    pill.type = "button";
    pill.setAttribute("aria-label", "Open BlookJS");
    pill.innerHTML = svg(ICON_ZAP, 18) + "<span>BlookJS</span>";

    const toggleRow = (label, hint, get, set) => {
      const row = el("div", "row");
      const text = el("div", "");
      text.append(el("div", "label", label));
      if (hint) text.append(el("div", "sub", hint));
      const sw = el("button", "switch");
      sw.type = "button";
      sw.setAttribute("role", "switch");
      sw.setAttribute("aria-label", label);
      const sync = () => sw.setAttribute("aria-checked", String(Boolean(get())));
      sw.addEventListener("click", () => {
        set(!get());
        setStatus(label + (get() ? " on" : " off"));
        refresh();
      });
      row.append(text, sw);
      updaters.push(sync);
      sync();
      return row;
    };

    const infoList = entries => {
      const dl = el("dl", "info");
      entries.forEach(([label, read]) => {
        const dd = el("dd", "");
        dl.append(el("dt", "", label), dd);
        const sync = () => {
          const value = read();
          dd.textContent = value.text;
          dd.className = value.tone || "";
        };
        updaters.push(sync);
        sync();
      });
      return dl;
    };

    const actionButton = (label, tone, run) => {
      const button = el("button", "btn " + tone, label);
      button.type = "button";
      button.addEventListener("click", async () => {
        try {
          setStatus(await run());
        } catch (error) {
          setStatus("Error: " + error.message);
        }
        refresh();
      });
      return button;
    };

    const section = (title, nodes, open = true) => {
      const box = el("div", "section");
      const header = el("button", "section-head");
      header.type = "button";
      header.setAttribute("aria-expanded", String(open));
      const chev = el("span", "chev");
      chev.innerHTML = svg(ICON_CHEVRON, 16);
      header.append(el("span", "", title), chev);
      const content = el("div", "section-body");
      content.append(...nodes);
      content.hidden = !open;
      header.addEventListener("click", () => {
        const willOpen = content.hidden;
        content.hidden = !willOpen;
        header.setAttribute("aria-expanded", String(willOpen));
      });
      box.append(header, content);
      return box;
    };

    const questPane = el("div", "body");
    const questButtons = el("div", "buttons");
    questButtons.append(
      actionButton("Reveal Contents", "blue", () => {
        const prize = api.quest.reveal();
        return prize ? "Showing " + oneLine(prize.text) : "No prize pending";
      }),
      actionButton("Skip Prize", "red", async () => {
        const result = await api.quest.skipOption(true);
        if (!result.sent) return "Not skipped: " + result.reason;
        return result.worked ? "Prize skipped" : "Server ignored the skip";
      }),
      actionButton("Claim Prize", "purple", async () => {
        const result = await api.quest.pickPrize();
        if (!result.sent) return "Not picked: " + result.reason;
        return "Picked: " + (result.prize ? oneLine(result.prize.text) : "prize");
      }),
    );
    questPane.append(
      section("Automation", [
        toggleRow("Dual Mode", "Reveal, skip and pick prizes", () => {
          const st = questStatus();
          return st.reveal && st.skip && st.prize;
        }, v => api.quest.dualMode(v)),
        toggleRow("Auto Reveal", "Show prize on the pumpkins", () => questAuto, v => api.quest.autoReveal(v)),
        toggleRow("Auto Skip", "Skip Lose to the King prizes", () => flags.skip, v => api.quest.autoSkip(v)),
        toggleRow("Auto Prize", "Pick first pumpkin and claim", () => flags.prize, v => api.quest.autoPrize(v)),
        toggleRow("Random Answer", "Answer questions at random", () => flags.random, v => api.quest.randomAnswer(v)),
      ]),
      section("Status", [
        infoList([
          ["Stage", () => ({ text: api.quest.getStage() ?? "-" })],
          ["Prize", () => {
            const prize = questPrize();
            return prize ? { text: oneLine(prize.text), tone: toneFor(prize.type) } : { text: "-", tone: "muted" };
          }],
          ["Gold", () => {
            const gold = api.quest.getGold();
            return { text: gold === null || gold === undefined ? "-" : String(gold) };
          }],
        ]),
      ]),
      section("Actions", [questButtons]),
    );

    const cryptoPane = el("div", "body");
    const cryptoButtons = el("div", "buttons");
    cryptoButtons.append(
      actionButton("Reveal Contents", "blue", () => {
        const prize = api.crypto.reveal();
        return prize ? "Showing " + oneLine(prize.text ?? prize.type) : "No prize yet";
      }),
      actionButton("Skip Prize", "red", async () => {
        const result = await api.crypto.skipPrize(true);
        if (!result.sent) return "Not skipped: " + result.reason;
        return result.worked ? "Prize skipped" : "Server ignored the skip";
      }),
      actionButton("Claim Prize", "purple", () => {
        const result = api.crypto.claim();
        if (!result.sent) return "Not claimed: " + result.reason;
        return "Claimed: " + oneLine(result.prize.text ?? result.prize.type);
      }),
      actionButton("Skip Hack", "yellow", () => (api.crypto.claimPrize(true) ? "Claim sent with skip" : "Not in a game")),
    );
    cryptoPane.append(
      section("Automation", [
        toggleRow("Dual Mode", "Reveal, skip and claim prizes", () => {
          const st = cryptoStatus();
          return st.reveal && st.skip && st.prize;
        }, v => api.crypto.dualMode(v)),
        toggleRow("Auto Reveal", "Show prize on the boxes", () => auto, v => api.crypto.autoReveal(v)),
        toggleRow("Auto Skip", "Skip hack prizes", () => cflags.skip, v => api.crypto.autoSkip(v)),
        toggleRow("Auto Prize", "Claim prizes automatically", () => cflags.prize, v => api.crypto.autoPrize(v)),
        toggleRow("Random Answer", "Answer questions at random", () => flags.random, v => api.crypto.randomAnswer(v)),
      ]),
      section("Status", [
        infoList([
          ["Stage", () => ({ text: api.crypto.getStage() ?? "-" })],
          ["Prize", () => (lastPrize
            ? { text: oneLine(lastPrize.text ?? lastPrize.type), tone: toneFor(lastPrize.type) }
            : { text: "-", tone: "muted" })],
          ["Crypto", () => {
            const score = api.crypto.getCrypto();
            return { text: score === null || score === undefined ? "-" : String(score) };
          }],
          ["Hack target", () => ({ text: lastHackOptions ? lastHackOptions.targetPlayerName : "-" })],
          ["Options left", () => {
            const hints = api.crypto.hack.hints();
            return { text: hints ? String(hints.remaining.length) + " of " + lastHackOptions.passwordIndexes.length : "-" };
          }],
        ]),
      ]),
      section("Actions", [cryptoButtons]),
    );

    const panes = { quest: questPane, crypto: cryptoPane };
    const tabs = el("div", "tabs");
    tabs.setAttribute("role", "tablist");
    const tabButtons = {};
    const select = name => {
      Object.keys(panes).forEach(key => {
        panes[key].hidden = key !== name;
        tabButtons[key].setAttribute("aria-selected", String(key === name));
      });
    };
    [["quest", "Gold Quest"], ["crypto", "Crypto Hack"]].forEach(([key, label]) => {
      const tab = el("button", "tab", label);
      tab.type = "button";
      tab.setAttribute("role", "tab");
      tab.addEventListener("click", () => select(key));
      tabButtons[key] = tab;
      tabs.append(tab);
    });
    select(/crypto/i.test(document.title) ? "crypto" : "quest");

    panel.append(head, tabs, questPane, cryptoPane, status);
    wrap.append(panel, pill);
    shadow.append(style, wrap);

    const setMin = value => wrap.classList.toggle("min", value);
    minBtn.addEventListener("click", () => setMin(true));
    pill.addEventListener("click", () => setMin(false));
    host.addEventListener("blookjs-show", () => setMin(false));
    host.addEventListener("blookjs-hide", () => setMin(true));
    host.addEventListener("blookjs-toggle", () => setMin(!wrap.classList.contains("min")));

    let drag = null;
    head.addEventListener("pointerdown", event => {
      if (event.target.closest("button")) return;
      const rect = wrap.getBoundingClientRect();
      drag = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
      if (head.setPointerCapture) head.setPointerCapture(event.pointerId);
    });
    head.addEventListener("pointermove", event => {
      if (!drag) return;
      const x = Math.min(Math.max(0, event.clientX - drag.dx), window.innerWidth - wrap.offsetWidth);
      const y = Math.min(Math.max(0, event.clientY - drag.dy), window.innerHeight - wrap.offsetHeight);
      wrap.style.left = x + "px";
      wrap.style.top = y + "px";
      wrap.style.right = "auto";
      wrap.style.bottom = "auto";
    });
    const endDrag = () => {
      drag = null;
    };
    head.addEventListener("pointerup", endDrag);
    head.addEventListener("pointercancel", endDrag);

    refreshMenu = refresh;
    return host;
  };

  const onKey = event => {
    if (event.altKey && event.code === "KeyB" && menuHost) {
      menuHost.dispatchEvent(new CustomEvent("blookjs-toggle"));
    }
  };

  const onHackClick = event => {
    const target = event.target;
    const button = target && target.closest ? target.closest(HACK_BUTTON_SELECTOR) : null;
    if (!button || !lastHackOptions) return;
    const position = hackButtons().indexOf(button);
    if (position < 0) return;
    lastGuess = { target: lastHackOptions.targetPlayerName, index: lastHackOptions.passwordIndexes[position] };
  };

  const start = () => {
    document.addEventListener("click", onHackClick, true);
    removeHackClick = () => document.removeEventListener("click", onHackClick, true);
    menuHost = buildMenu();
    document.body.appendChild(menuHost);
    window.addEventListener("keydown", onKey);
    removeKeyHandler = () => window.removeEventListener("keydown", onKey);
    timers.refresh = setInterval(() => refreshMenu(), 400);
  };

  observer = new MutationObserver(() => {
    if (auto && lastPrize) paint(lastPrize);
    if (questAuto) {
      const prize = questPrize();
      if (prize) paintQuest(prize);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  timers.attach = setInterval(attach, 500);
  attach();
  window.BlookJS = api;
  start();
})();
