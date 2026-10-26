(() => {
  if (window.BlookJS && typeof window.BlookJS.destroy === "function") window.BlookJS.destroy();

  const CHOICE_SELECTOR = '[class*="_choiceInside_"]';
  const HACK_BUTTON_SELECTOR = '[class*="_buttonContainer_"] [class*="_button_"]';
  const PUMPKIN_SELECTOR = '[class*="_choice1_"], [class*="_choice2_"], [class*="_choice3_"]';
  const wrongGuesses = new Map();
  const flags = { skip: false, prize: false, random: false, cont: false };
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
  let cryptoSkipTypes = [];
  const cflags = { skip: false, prize: false, random: false, cont: false };
  const GUESS_WAIT = 4500;
  let answered = null;
  let seenQuestion = null;
  let lastAnswerScan = 0;
  let contState = null;
  let lastContinue = 0;
  let answerDelay = 0;
  let destroyed = false;
  const fflags = { fish: false, random: false, cont: false, reveal: false, skip: false };
  const gflags = { random: false, cont: false };
  let lobbyBusy = false;
  let fakeOn = false;
  const fakeAdded = new Map();
  let lastActionVia = "";
  let fakeTimer = null;
  const kflags = { serve: false, ask: false };
  let lastCafe = 0;
  let lastAsk = 0;
  const lastServe = new Map();
  const armedSell = { kind: null, until: 0 };
  let lastFish = 0;
  let onlineType = null;
  let lastReveal = 0;
  let lastSkipTick = 0;
  let distractHash;
  let fontFaces = [];
  let unlimitedMinutes = false;
  let removeMinutesGuard = () => {};
  let distractHashAt = 0;
  let lastPress = null;

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

  const rootFiber = () => {
    const holders = [
      document.getElementById("root"),
      document.getElementById("__next"),
      document,
      document.body,
      document.documentElement,
    ];
    for (const holder of holders) {
      if (!holder) continue;
      const key = Object.keys(holder).find(k => k.startsWith("__reactContainer$"));
      if (!key) continue;
      const host = holder[key];
      return host && host.stateNode && host.stateNode.current ? host.stateNode.current : host;
    }
    return null;
  };

  const walk = visit => {
    const start = rootFiber();
    if (!start) return;
    const stack = [start];
    while (stack.length) {
      const fiber = stack.pop();
      if (visit(fiber.memoizedProps, fiber)) return;
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
    if (now - cachedAt < (cachedCtx ? 1500 : 500)) return cachedCtx;
    cachedCtx = findContext();
    cachedAt = now;
    return cachedCtx;
  };

  const send = (type, payload) => {
    if (destroyed) return false;
    const ctx = getCtx();
    if (!ctx) return false;
    ctx.send(type, payload);
    return true;
  };

  const plain = value => (value && typeof value.toJSON === "function" ? value.toJSON() : value);

  const stageIs = (player, name) => Boolean(player) && String(player.stage || "").toLowerCase() === name;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  const hackButtons = () => [...document.querySelectorAll(HACK_BUTTON_SELECTOR)];

  const isNothing = prize => Boolean(prize) && (prize.type === "nothing" || /^nothing\b/i.test(String(prize.text || "")));

  const questSkippable = prize => Boolean(prize) && (prize.type === "give" || isNothing(prize));

  const cryptoSkippable = prize => Boolean(prize) && (cryptoSkipTypes.includes(prize.type) || isNothing(prize));

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
          fontFamily: "'BlookJS Nunito', 'Nunito', system-ui, sans-serif",
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
    if (!force && !questSkippable(prize)) return Promise.resolve({ sent: false, reason: "prize is not skippable", prize });
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
    const feedback = props.feedbacks ? props.feedbacks[index] : undefined;
    return { props, index, question, choices, feedback, done: Boolean(feedback) };
  };

  const questionKey = info => info.index + ":" + (info.question.number ?? "") + ":" + info.question.text;

  const pressKey = key => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, code: "Digit" + key, bubbles: true, cancelable: true }));
  };

  const randomAnswerTick = () => {
    const now = Date.now();
    if (now - lastAnswerScan < 40) return;
    lastAnswerScan = now;
    const info = readQuestion();
    if (!info) {
      answered = null;
      seenQuestion = null;
      return;
    }
    const key = questionKey(info);
    if (info.done) {
      answered = null;
      return;
    }
    if (!info.choices.length) return;
    if (!seenQuestion || seenQuestion.key !== key) seenQuestion = { key, due: now + answerDelay };
    if (now < seenQuestion.due) return;
    if (!answered || answered.key !== key) {
      const position = Math.floor(Math.random() * info.choices.length);
      answered = { key, at: now, via: position < 4 ? "key" : "direct", position };
      if (position >= 4) {
        info.props.sendAnswer(info.choices[position]);
        return;
      }
    }
    if (answered.via !== "key") return;
    if (now - answered.at > 2000) {
      answered = { ...answered, via: "direct" };
      info.props.sendAnswer(info.choices[answered.position]);
      return;
    }
    pressKey(String(answered.position + 1));
  };

  const continueTick = () => {
    const now = Date.now();
    if (now - lastContinue < 40) return;
    lastContinue = now;
    const info = readQuestion();
    if (!info || !info.done) {
      contState = null;
      return;
    }
    const key = questionKey(info);
    if (!contState || contState.key !== key) contState = { key, sends: 0, last: 0 };
    if (contState.sends >= 6 || now - contState.last < 400) return;
    contState.sends += 1;
    contState.last = now;
    if (contState.sends === 1 && typeof info.props.sendAnswerNext === "function") {
      info.props.sendAnswerNext();
      return;
    }
    window.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  };

  const FISH_ODDS = [
    [["Old Boot", 15], ["Waffle", 5], ["Two of Spades", 5], ["Jellyfish", 15], ["Clownfish", 15], ["Goldfish", 10], ["Frog", 15], ["Blizzard Clownfish", 5], ["Turtle", 5], ["Cat", 5], ["Lovely Frog", 3], ["Lucky Frog", 1], ["Poison Dart Frog", 1]],
    [["Old Boot", 3], ["Waffle", 1], ["Two of Spades", 1], ["Jellyfish", 10], ["Clownfish", 5], ["Goldfish", 3], ["Frog", 10], ["Blizzard Clownfish", 7], ["Turtle", 4], ["Cat", 3], ["Lovely Frog", 6], ["Lucky Frog", 1], ["Poison Dart Frog", 5], ["Seal", 5], ["Walrus", 5], ["Fairy", 2], ["Crab", 10], ["Lemon Crab", 7], ["Pufferfish", 7], ["Blobfish", 5]],
    [["Jellyfish", 5], ["Frog", 5], ["Blizzard Clownfish", 2], ["Turtle", 1], ["Cat", 1], ["Lovely Frog", 1], ["Lucky Frog", 1], ["Poison Dart Frog", 2], ["Seal", 5], ["Walrus", 5], ["Fairy", 2], ["Crab", 10], ["Lemon Crab", 6], ["Pufferfish", 10], ["Blobfish", 10], ["Rainbow Jellyfish", 6], ["Octopus", 15], ["Pirate Pufferfish", 4], ["Donut Blobfish", 4], ["Crimson Octopus", 5]],
    [["Seal", 3], ["Walrus", 3], ["Fairy", 2], ["Crab", 5], ["Lemon Crab", 2], ["Pufferfish", 8], ["Blobfish", 8], ["Rainbow Jellyfish", 10], ["Octopus", 15], ["Pirate Pufferfish", 8], ["Donut Blobfish", 8], ["Crimson Octopus", 7], ["Narwhal", 8], ["Baby Shark", 7], ["Megalodon", 6]],
    [["Crab", 1], ["Lemon Crab", 1], ["Pufferfish", 1], ["Blobfish", 3], ["Rainbow Jellyfish", 6], ["Octopus", 12], ["Pirate Pufferfish", 8], ["Donut Blobfish", 8], ["Crimson Octopus", 10], ["Narwhal", 17], ["Baby Shark", 14], ["Megalodon", 12], ["Alien", 1.2], ["Rainbow Narwhal", 4.25], ["UFO", 1], ["Santa Claus", 0.1], ["Swamp Monster", 0.1], ["Red Astronaut", 0.1], ["Spooky Pumpkin", 0.1], ["Dragon", 0.1], ["Tim the Alien", 0.05]],
  ];

  const soloFishState = () => {
    let found = null;
    walk((props, fiber) => {
      if (props && fiber && typeof props.setWeight === "function" && typeof props.endGame === "function" && "weight" in props) {
        found = { props, fiber };
        return true;
      }
      return false;
    });
    if (!found) return null;
    const hooks = [];
    let hook = found.fiber.memoizedState;
    while (hook && hooks.length < 40) {
      hooks.push(hook.memoizedState);
      hook = hook.next;
    }
    const valid = typeof hooks[1] === "number" && typeof hooks[2] === "boolean" && typeof hooks[3] === "number"
      && typeof hooks[4] === "boolean" && typeof hooks[5] === "boolean" && typeof hooks[6] === "boolean"
      && typeof hooks[11] === "string" && typeof hooks[12] === "boolean";
    if (!valid) return null;
    const stage = stageOf({
      question: hooks[12],
      text: hooks[11],
      caught: hooks[7],
      claimReady: hooks[6],
      hooked: hooks[4],
      isCast: hooks[2],
      castReady: hooks[5],
    });
    const caught = hooks[9];
    let prize = null;
    if (caught && typeof caught === "object") {
      prize = { name: caught.name, rarity: caught.rarity, tier: caught.tier, weight: caught.weight };
    } else if (caught === "Lure Upgrade") {
      prize = { name: "Lure Upgrade", rarity: "Upgrade", weight: 0 };
    } else if (caught === "Frenzy") {
      prize = { name: "Frenzy!", rarity: "Special", weight: 0 };
    }
    return {
      stage,
      online: false,
      weight: found.props.weight,
      prize,
      lure: hooks[3],
      frenzy: hooks[1] > Date.now(),
      secondsLeft: typeof hooks[13] === "number" ? hooks[13] : null,
    };
  };

  const stageOf = st => {
    if (st.question) return "Question";
    if (st.caught) return st.claimReady ? "Claim" : "Caught";
    if (st.hooked) return "Hooked";
    if (st.isCast) return "Casting";
    if (st.text === "lost" && !st.castReady) return "Lost";
    if (st.castReady) return "Ready";
    return "Idle";
  };

  const hookList = fiber => {
    const list = [];
    let hook = fiber.memoizedState;
    while (hook && list.length < 40) {
      list.push(hook.memoizedState);
      hook = hook.next;
    }
    return list;
  };

  const looksOnline = h => typeof h[0] === "number" && typeof h[1] === "number" && typeof h[2] === "number"
    && typeof h[3] === "boolean" && typeof h[4] === "boolean" && typeof h[5] === "boolean" && typeof h[6] === "boolean"
    && typeof h[7] === "string" && typeof h[9] === "boolean" && typeof h[11] === "boolean" && typeof h[12] === "string"
    && (h[8] === null || typeof h[8] === "object" || typeof h[8] === "string");

  const findOnlineHooks = () => {
    let result = null;
    walk((props, fiber) => {
      if (!fiber || typeof fiber.type !== "function" || !fiber.memoizedState) return false;
      if (onlineType && fiber.type !== onlineType) return false;
      const list = hookList(fiber);
      if (!looksOnline(list)) return false;
      onlineType = fiber.type;
      result = list;
      return true;
    });
    return result;
  };

  const activeDistractions = () => {
    const ctx = getCtx();
    const out = [];
    if (!ctx || !ctx.room.state.distractions) return out;
    const now = Date.now();
    ctx.room.state.distractions.forEach((d, id) => {
      if (d.endTime > now) out.push({ id, fish: d.fishName, by: d.triggeredBy, secondsLeft: Math.ceil((d.endTime - now) / 1000) });
    });
    return out;
  };

  const onlineFishState = player => {
    const ctx = getCtx();
    const h = findOnlineHooks();
    const question = Boolean(player.inQuestion);
    const stage = h
      ? stageOf({ question, text: h[12], caught: h[7], claimReady: h[6], hooked: h[4], isCast: h[3], castReady: h[5] })
      : (question ? "Question" : "Idle");
    let prize = null;
    if (player.pendingFishIsLureUpgrade) {
      prize = { name: "Lure Upgrade", rarity: "Upgrade", weight: 0 };
    } else if (player.pendingFishIsFrenzy) {
      prize = { name: "Frenzy!", rarity: "Special", weight: 0 };
    } else if (player.pendingFishName) {
      prize = {
        name: player.pendingFishName,
        rarity: player.pendingFishRarity,
        tier: player.pendingFishTier,
        weight: player.pendingFishWeight,
        special: Boolean(player.pendingFishIsSpecial),
      };
    } else if (h && h[8] && typeof h[8] === "object") {
      prize = { name: h[8].name, rarity: h[8].rarity, tier: h[8].tier, weight: h[8].weight, special: Boolean(h[8].isSpecial) };
    }
    return {
      stage,
      online: true,
      weight: player.weight,
      prize,
      lure: player.lure,
      frenzy: Boolean(ctx && ctx.room.state.frenzyEndTime > Date.now()),
      secondsLeft: h && typeof h[10] === "number" ? h[10] : null,
      distractions: activeDistractions(),
    };
  };

  const fishState = () => {
    const player = me();
    if (player && typeof player.pendingFishName === "string") return onlineFishState(player);
    return soloFishState();
  };

  const NO_DISTRACT_ID = "blookjs-nodistract";

  const findDistractHash = () => {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch (error) {
        continue;
      }
      for (const rule of Array.from(rules || [])) {
        const match = /\._crabDance1_([a-z0-9]+)_\d+/.exec(rule.selectorText || "");
        if (match) return match[1];
      }
    }
    return null;
  };

  const hideDistractions = () => {
    if (document.getElementById(NO_DISTRACT_ID)) return;
    const now = Date.now();
    if (distractHash === undefined || (distractHash === null && now - distractHashAt > 3000)) {
      distractHash = findDistractHash();
      distractHashAt = now;
    }
    if (distractHash) {
      const style = document.createElement("style");
      style.id = NO_DISTRACT_ID;
      style.textContent = '[class*="_wrapper_' + distractHash + '_"] { display: none !important; }';
      document.head.appendChild(style);
      return;
    }
    walk((props, fiber) => {
      if (props && typeof props.fish === "string" && !("lureLevel" in props) && fiber.child) {
        let node = fiber.child;
        while (node && !(node.stateNode && node.stateNode.nodeType === 1)) node = node.child;
        if (node && node.stateNode.style) node.stateNode.style.display = "none";
        return true;
      }
      return false;
    });
  };

  const showDistractions = () => {
    const style = document.getElementById(NO_DISTRACT_ID);
    if (style) style.remove();
  };

  const fishSkipTick = () => {
    const now = Date.now();
    if (now - lastSkipTick < 150) return;
    lastSkipTick = now;
    hideDistractions();
  };

  const fishRevealTick = () => {
    const now = Date.now();
    if (now - lastReveal < 150) return;
    lastReveal = now;
    const st = fishState();
    let badge = document.querySelector('[data-blookjs="reveal"]');
    if (!st || !st.online || !st.prize) {
      if (badge) badge.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement("div");
      badge.setAttribute("data-blookjs", "reveal");
      Object.assign(badge.style, {
        position: "fixed",
        top: "12px",
        left: "50%",
        transform: "translateX(-50%)",
        padding: "8px 18px",
        background: "#18181b",
        color: "#fafafa",
        borderRadius: "12px",
        fontFamily: "'BlookJS Nunito', 'Nunito', system-ui, sans-serif",
        fontWeight: "800",
        fontSize: "15px",
        pointerEvents: "none",
        whiteSpace: "nowrap",
        zIndex: "2147482000",
      });
      document.body.appendChild(badge);
    }
    const text = "Next: " + fishPrizeText(st.prize) + (st.prize.rarity ? " - " + st.prize.rarity : "");
    if (badge.textContent !== text) badge.textContent = text;
  };

  const PROTECTED_RARITIES = ["Legendary", "Chroma", "Mystical", "Unique"];
  const SELL_ACTION_ID = "504d5bfe3d4b01def79630a2138ec4f50f85bee9";
  const BUY_PACK_ACTION_ID = "07f506cbf77b3c76f2fe32f5e1ef295935f4c113";

  const webpackRequires = () => {
    const out = [];
    Object.keys(window).filter(k => k.startsWith("webpackChunk")).forEach(k => {
      const chunk = window[k];
      if (!chunk || typeof chunk.push !== "function") return;
      try {
        chunk.push([[Symbol("blookjs")], {}, r => {
          out.push(r);
        }]);
      } catch (error) {
        return;
      }
    });
    return out;
  };

  const findCallServer = () => {
    const info = { globals: Object.keys(window).filter(k => k.startsWith("webpackChunk")), requires: 0, cached: 0, fn: null };
    for (const req of webpackRequires()) {
      info.requires += 1;
      const cache = req.c || {};
      for (const id of Object.keys(cache)) {
        info.cached += 1;
        let fn = null;
        try {
          const entry = cache[id];
          fn = entry && entry.exports && entry.exports.callServer;
        } catch (error) {
          fn = null;
        }
        if (typeof fn === "function") {
          info.fn = fn;
          return info;
        }
      }
      const factories = req.m || {};
      for (const id of Object.keys(factories)) {
        let text = "";
        try {
          text = String(factories[id]);
        } catch (error) {
          text = "";
        }
        if (text.indexOf("getServerActionDispatcher") === -1 || text.indexOf("callServer") === -1) continue;
        try {
          const mod = req(id);
          if (mod && typeof mod.callServer === "function") {
            info.fn = mod.callServer;
            return info;
          }
        } catch (error) {
          continue;
        }
      }
    }
    return info;
  };

  const fetchAction = async (id, fields) => {
    const body = new FormData();
    body.append("0", JSON.stringify([{ message: "", status: "idle" }, "$K1"]));
    Object.keys(fields).forEach(key => body.append("1_" + key, fields[key]));
    const response = await fetch(window.location.pathname + window.location.search, {
      method: "POST",
      headers: { Accept: "text/x-component", "Next-Action": id },
      body,
      credentials: "same-origin",
    });
    const text = await response.text();
    const chunks = {};
    text.split("\n").forEach(line => {
      const match = /^([0-9a-f]+):(.*)$/.exec(line);
      if (match) chunks[match[1]] = match[2];
    });
    if (!Object.keys(chunks).length) throw new Error("server action request failed (HTTP " + response.status + ")");
    let root = null;
    try {
      root = JSON.parse(chunks["0"] || "null");
    } catch (error) {
      root = null;
    }
    const ref = root && typeof root.a === "string" ? root.a.replace(/^\$@?/, "") : "1";
    const raw = chunks[ref];
    if (raw === undefined) throw new Error("unexpected server response (HTTP " + response.status + ")");
    if (raw.charAt(0) === "E") throw new Error("the server threw an error (HTTP " + response.status + ")");
    const value = JSON.parse(raw);
    return typeof value === "string" ? null : value;
  };

  const runAction = async (id, fields) => {
    const info = findCallServer();
    if (info.fn) {
      const form = new FormData();
      Object.keys(fields).forEach(key => form.append(key, fields[key]));
      try {
        lastActionVia = "callServer";
        return await info.fn(id, [{ message: "", status: "idle" }, form]);
      } catch (error) {
        if (!/dispatcher/i.test(String(error && error.message))) throw error;
      }
    }
    lastActionVia = "fetch";
    return fetchAction(id, fields);
  };

  const readActionResult = result => {
    if (!result || typeof result !== "object") return { ok: false, error: "no response from the server" };
    let data = null;
    if (typeof result.message === "string") {
      try {
        data = JSON.parse(result.message);
      } catch (error) {
        data = null;
      }
    }
    if (result.error || result.status === "error") {
      return { ok: false, error: String(result.error || result.message || "the server rejected the request") };
    }
    if (data && typeof data === "object") return { ok: true, data };
    return { ok: false, error: String(result.message || result.status || "unexpected response") };
  };

  const lobbyLock = async run => {
    if (lobbyBusy) return { ok: false, error: "another Lobby action is still running" };
    lobbyBusy = true;
    try {
      return await run();
    } catch (error) {
      return { ok: false, error: error && error.message ? error.message : String(error) };
    } finally {
      lobbyBusy = false;
    }
  };

  const marketState = () => {
    let found = null;
    walk(props => {
      if (props && Array.isArray(props.packs) && typeof props.setUserTokens === "function" && "userTokens" in props) {
        found = props;
        return true;
      }
      return false;
    });
    return found;
  };

  const packKey = name => String(name || "").trim().toLowerCase().replace(/\s*pack$/, "");

  const findPack = (state, wanted) => state.packs.find(p => packKey(p.name) === packKey(wanted)) || null;

  const buyPacks = async (packName, amountRaw, report) => {
    const state = marketState();
    if (!state) return { ok: false, error: "open the Market page first" };
    if (!String(packName || "").trim()) return { ok: false, error: "type a pack name" };
    const pack = findPack(state, packName);
    if (!pack) {
      return { ok: false, error: 'no pack named "' + String(packName).trim() + '" - available: ' + state.packs.map(p => p.name).join(", ") };
    }
    const amount = Math.floor(Number(amountRaw));
    if (!Number.isFinite(amount) || amount < 1) return { ok: false, error: "amount must be 1 or more" };
    if (typeof state.userTokens !== "number") return { ok: false, error: "token balance has not loaded yet" };
    const cost = pack.price * amount;
    if (cost > state.userTokens) {
      return { ok: false, error: "need " + cost.toLocaleString() + " tokens for " + amount + " x " + pack.name + ", you have " + state.userTokens.toLocaleString() };
    }
    let remaining = amount;
    let bought = 0;
    let opened = 0;
    let fresh = 0;
    let left = state.userTokens;
    while (remaining > 0) {
      const chunk = Math.min(remaining, 100);
      const result = await runAction(BUY_PACK_ACTION_ID, {
        itemId: pack.packId,
        quantity: String(chunk),
        shopItem: JSON.stringify({ name: pack.name, price: pack.price, itemId: pack.packId }),
      });
      const parsed = readActionResult(result);
      if (!parsed.ok) return { ok: false, error: parsed.error, pack: pack.name, bought, opened, fresh, tokensLeft: left };
      const info = Array.isArray(parsed.data.purchaseInfo) ? parsed.data.purchaseInfo : [];
      opened += info.length;
      fresh += info.filter(i => i && i.isNewToUser).length;
      const rest = parseInt(parsed.data.remainingTokens, 10);
      if (Number.isFinite(rest)) {
        left = rest;
        const live = marketState();
        if (live) live.setUserTokens(rest);
      }
      bought += chunk;
      remaining -= chunk;
      if (report) report("Bought " + bought + " of " + amount + "...");
    }
    return { ok: true, pack: pack.name, bought, opened, fresh, tokensLeft: left };
  };

  const blooksState = () => {
    let found = null;
    walk(props => {
      if (props && Array.isArray(props.userBlooks) && typeof props.setUserBlooks === "function" && Array.isArray(props.packs)) {
        found = props;
        return true;
      }
      return false;
    });
    return found;
  };

  const blookCatalog = state => {
    const map = new Map();
    const add = pack => (pack && pack.blooks ? pack.blooks : []).forEach(b => {
      if (b && b.name && !map.has(b.name)) map.set(b.name, b);
    });
    state.packs.forEach(add);
    (state.freePacks || []).forEach(add);
    return map;
  };

  const isFakeEntry = entry => fakeAdded.has(entry.blook) && entry.quantity === 1 && entry.sellPrice === fakeAdded.get(entry.blook);

  const sellPlan = kind => {
    const state = blooksState();
    if (!state) return { ok: false, error: "open the Blooks page first" };
    const catalog = blookCatalog(state);
    const items = [];
    state.userBlooks.forEach(entry => {
      if (isFakeEntry(entry)) return;
      const meta = catalog.get(entry.blook);
      const rarity = meta && meta.rarity;
      if (!rarity) return;
      const owned = Number(entry.quantity) || 0;
      let sell = 0;
      if (kind === "duplicates") sell = PROTECTED_RARITIES.includes(rarity) ? 0 : owned - 1;
      else if (kind === "commons") sell = rarity === "Common" ? owned : 0;
      else if (kind === "uncommons") sell = rarity === "Common" || rarity === "Uncommon" ? owned : 0;
      if (sell > 0) items.push({ name: entry.blook, rarity, quantity: sell, owned, last: sell >= owned, price: Number(entry.sellPrice) || 0 });
    });
    return {
      ok: true,
      kind,
      items,
      copies: items.reduce((sum, i) => sum + i.quantity, 0),
      tokens: items.reduce((sum, i) => sum + i.quantity * i.price, 0),
    };
  };

  const sellBlooks = async (kind, report) => {
    const plan = sellPlan(kind);
    if (!plan.ok) return plan;
    if (!plan.items.length) return { ok: true, kinds: 0, copies: 0, tokens: null };
    let copies = 0;
    let kinds = 0;
    let tokens = null;
    for (const item of plan.items) {
      const fields = { blook: item.name, quantity: String(item.quantity) };
      if (item.last) fields.confirm = item.name;
      const result = await runAction(SELL_ACTION_ID, fields);
      const parsed = readActionResult(result);
      if (!parsed.ok) return { ok: false, error: item.name + ": " + parsed.error, kinds, copies, tokens };
      const remaining = parseInt(parsed.data.remainingQuantity, 10);
      const rest = parseInt(parsed.data.tokens, 10);
      copies += item.quantity;
      kinds += 1;
      if (Number.isFinite(rest)) tokens = rest;
      const live = blooksState();
      if (live && Number.isFinite(remaining)) {
        live.setUserBlooks(list => {
          const others = list.filter(e => e.blook !== item.name);
          return remaining === 0 ? others : [...others, { blook: item.name, quantity: remaining, sellPrice: item.price }];
        });
        if (Number.isFinite(rest) && typeof live.setUserTokens === "function") live.setUserTokens(rest);
      }
      if (report) report("Sold " + kinds + " of " + plan.items.length + " blooks...");
      await sleep(120);
    }
    return { ok: true, kinds, copies, tokens };
  };

  const askSell = (kind, label, report) => {
    const plan = sellPlan(kind);
    if (!plan.ok) return Promise.resolve("Not sold: " + plan.error);
    if (!plan.items.length) return Promise.resolve("Nothing to sell (" + label + ")");
    const now = Date.now();
    if (armedSell.kind !== kind || now > armedSell.until) {
      armedSell.kind = kind;
      armedSell.until = now + 6000;
      return Promise.resolve("Press again to confirm (6 sec)");
    }
    armedSell.kind = null;
    return lobbyLock(() => sellBlooks(kind, report)).then(r => {
      if (!r.ok) return "Stopped: " + r.error + (r.copies ? " (sold " + r.copies + " copies first)" : "");
      return "Sold " + r.copies + " copies of " + r.kinds + " blooks" + (r.tokens !== null ? " - " + r.tokens.toLocaleString() + " tokens now" : "");
    });
  };

  const syncCardQuantities = list => {
    const byName = new Map(list.map(e => [e.blook, e.quantity]));
    walk((props, fiber) => {
      const blook = props && props.blook;
      if (blook && typeof blook === "object" && typeof blook.name === "string" && "rarity" in blook && typeof props.setUserBlooks === "function" && fiber.memoizedState) {
        let hook = fiber.memoizedState;
        for (let i = 0; i < 2 && hook; i += 1) hook = hook.next;
        if (hook && typeof hook.memoizedState === "number" && hook.queue && typeof hook.queue.dispatch === "function") {
          const target = byName.has(blook.name) ? byName.get(blook.name) : 0;
          if (hook.memoizedState !== target) hook.queue.dispatch(target);
        }
      }
      return false;
    });
  };

  const scheduleCardSync = list => {
    syncCardQuantities(list);
    [150, 600].forEach(ms => setTimeout(() => {
      if (!destroyed) syncCardQuantities(list);
    }, ms));
  };

  const FAKE_PRICES = { Common: 5, Uncommon: 20, Rare: 75, Epic: 350, Legendary: 1500, Chroma: 5000, Mystical: 10000, Unique: 20000 };

  const userBlooksSetter = state => {
    let setter = null;
    walk((props, fiber) => {
      if (props && Array.isArray(props.unlockedBlooks) && Array.isArray(props.modifiedPacks) && fiber.memoizedState) {
        let hook = fiber.memoizedState;
        while (hook) {
          if (Array.isArray(hook.memoizedState) && hook.memoizedState === state.userBlooks && hook.queue && typeof hook.queue.dispatch === "function") {
            setter = hook.queue.dispatch;
            break;
          }
          hook = hook.next;
        }
        return true;
      }
      return false;
    });
    return setter || state.setUserBlooks;
  };

  const setFakeUnlock = enabled => {
    const state = blooksState();
    if (!state) return { ok: false, error: "open the Blooks page first" };
    const set = userBlooksSetter(state);
    if (enabled) {
      const catalog = blookCatalog(state);
      const owned = new Set(state.userBlooks.map(e => e.blook));
      const realPrice = {};
      state.userBlooks.forEach(e => {
        const meta = catalog.get(e.blook);
        if (meta && meta.rarity && e.sellPrice > 0 && realPrice[meta.rarity] === undefined) realPrice[meta.rarity] = e.sellPrice;
      });
      const added = [];
      catalog.forEach((meta, name) => {
        if (owned.has(name)) return;
        const price = realPrice[meta.rarity] !== undefined ? realPrice[meta.rarity] : (FAKE_PRICES[meta.rarity] || 0);
        added.push({ blook: name, quantity: 1, sellPrice: price });
      });
      added.forEach(e => fakeAdded.set(e.blook, e.sellPrice));
      set(list => [...list, ...added.filter(e => !list.some(x => x.blook === e.blook))]);
      scheduleCardSync([...state.userBlooks, ...added.filter(e => !state.userBlooks.some(x => x.blook === e.blook))]);
      if (!fakeTimer) {
        fakeTimer = setInterval(() => {
          const live = blooksState();
          if (live) syncCardQuantities(live.userBlooks);
        }, 800);
      }
      fakeOn = true;
      return { ok: true, enabled: true, added: added.length };
    }
    const names = new Map(fakeAdded);
    const isFake = e => names.has(e.blook) && e.quantity === 1 && e.sellPrice === names.get(e.blook);
    set(list => list.filter(e => !isFake(e)));
    clearInterval(fakeTimer);
    fakeTimer = null;
    scheduleCardSync(state.userBlooks.filter(e => !isFake(e)));
    fakeAdded.clear();
    fakeOn = false;
    return { ok: true, enabled: false };
  };

  const isCafePlayer = p => Boolean(p) && Boolean(p.foods) && Boolean(p.customers);

  const pendingOrder = customer => {
    if (!customer || customer.hasPaid || !customer.order || !customer.order.lines) return false;
    return mapValues(customer.order.lines).some(quantity => Number(quantity) > 0);
  };

  const mapValues = collection => {
    const out = [];
    if (collection && typeof collection.forEach === "function") collection.forEach(value => out.push(value));
    return out;
  };

  const cafeState = () => {
    const player = me();
    if (!isCafePlayer(player)) return null;
    const foods = mapValues(player.foods);
    const customers = mapValues(player.customers).filter(pendingOrder);
    return {
      money: Number(player.score) || 0,
      level: player.cafeLevel,
      customers: customers.length,
      stock: foods.reduce((sum, f) => sum + (Number(f.quantity) || 0), 0),
      busySeconds: Math.max(0, Math.ceil(Number(player.remainingInspectionTime) || 0)),
      inQuestion: Boolean(player.inQuestion),
      inTutorial: Boolean(player.inTutorial),
    };
  };

  const serveCustomers = player => {
    const now = Date.now();
    let sent = 0;
    mapValues(player.customers).forEach(customer => {
      if (!pendingOrder(customer)) return;
      if (now - (lastServe.get(customer.id) || 0) < 450) return;
      lastServe.set(customer.id, now);
      if (send("playerPlaceCustomerOrder", { customer })) sent += 1;
    });
    return sent;
  };

  const askQuestion = () => send("playerPromptQuestion", {});

  const tickCafe = player => {
    const now = Date.now();
    if (now - lastCafe < 120) return;
    lastCafe = now;
    if (!isCafePlayer(player) || player.inTutorial || Number(player.remainingInspectionTime) > 0) return;
    if (kflags.serve) serveCustomers(player);
    if (kflags.ask && !player.inQuestion && now - lastAsk > 700) {
      lastAsk = now;
      askQuestion();
    }
  };

  const setCafeFlag = (name, enabled) => {
    kflags[name] = Boolean(enabled);
    syncLoop();
    return kflags[name];
  };

  const setGeneralFlag = (name, enabled) => {
    gflags[name] = Boolean(enabled);
    syncLoop();
    return gflags[name];
  };

  const minutesBox = () => document.getElementById("number");

  const findMinutesMenu = () => {
    let found = null;
    walk((props, fiber) => {
      if (props && typeof props.onStart === "function" && "askMinutes" in props && fiber.memoizedState) {
        found = fiber;
        return true;
      }
      return false;
    });
    return found;
  };

  const setMinutes = value => {
    const fiber = findMinutesMenu();
    const hook = fiber && fiber.memoizedState;
    const dispatch = hook && hook.queue && hook.queue.dispatch;
    if (typeof dispatch !== "function") return false;
    dispatch(Math.max(0, Math.floor(Number(value)) || 0));
    return true;
  };

  const onMinutesInput = event => {
    const target = event.target;
    if (!unlimitedMinutes || !target || target.id !== "number" || target.type !== "number") return;
    target.removeAttribute("max");
    if (!setMinutes(target.value)) return;
    event.stopImmediatePropagation();
  };

  const setTimeLimitRemoved = enabled => {
    unlimitedMinutes = Boolean(enabled);
    const box = minutesBox();
    if (unlimitedMinutes) {
      if (box) box.removeAttribute("max");
    } else if (box) {
      box.setAttribute("max", "30");
      if (Number(box.value) > 30) setMinutes(30);
    }
    return { enabled: unlimitedMinutes, boxFound: Boolean(box) };
  };

  const fishOdds = () => {
    const st = fishState();
    const level = st ? (st.frenzy ? Math.min(st.lure + 1, 4) : st.lure) : 0;
    const table = FISH_ODDS[Math.max(0, Math.min(level, FISH_ODDS.length - 1))];
    return table.map(([name, percent]) => ({ name, percent })).sort((a, b) => b.percent - a.percent);
  };

  const pressEnter = () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }));
  };

  const fishPrizeText = prize => (prize
    ? prize.name + (prize.weight ? " " + Number(prize.weight).toLocaleString() + " lbs" : "")
    : "-");

  const fishPress = wanted => {
    const st = fishState();
    if (!st) return { sent: false, reason: "not in a fishing game" };
    if (!wanted.includes(st.stage)) return { sent: false, reason: "nothing to do while " + st.stage.toLowerCase(), stage: st.stage };
    pressEnter();
    return { sent: true, stage: st.stage, prize: st.prize };
  };

  const fishTick = () => {
    const now = Date.now();
    if (now - lastFish < 70) return;
    lastFish = now;
    const st = fishState();
    if (!st) return;
    if (st.stage !== "Ready" && st.stage !== "Hooked" && st.stage !== "Claim") return;
    if (lastPress && lastPress.stage === st.stage && now - lastPress.at < 700) return;
    lastPress = { stage: st.stage, at: now };
    pressEnter();
  };

  const setFishFlag = (name, enabled) => {
    fflags[name] = Boolean(enabled);
    if (name === "skip" && !fflags.skip) showDistractions();
    if (name === "reveal" && !fflags.reveal) {
      const badge = document.querySelector('[data-blookjs="reveal"]');
      if (badge) badge.remove();
    }
    syncLoop();
    return fflags[name];
  };

  const fishStatus = () => ({ reveal: fflags.reveal, skip: fflags.skip, fish: fflags.fish, random: fflags.random, cont: fflags.cont });

  const claimCryptoPrize = () => {
    const player = me();
    if (!player) return { sent: false, reason: "not in a game" };
    if (!lastPrize) return { sent: false, reason: "no prize yet" };
    if (player.defensiveHackType) return { sent: false, reason: "you are being hacked" };
    const prize = lastPrize;
    const skipHack = false;
    const sent = send("claimPrize", { skipHack });
    if (sent) cryptoFresh = false;
    return { sent, prize, skipHack, reason: sent ? undefined : "not in a game" };
  };

  const skipCryptoPrize = (force = false) => {
    const player = me();
    if (!player || !lastPrize) return Promise.resolve({ sent: false, reason: "no pending prize" });
    if (!stageIs(player, "prize")) return Promise.resolve({ sent: false, reason: "not on prize stage", prize: lastPrize });
    if (!force && !cryptoSkippable(lastPrize)) {
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
    if (cflags.skip && cryptoSkippable(prize)) {
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
        if (lastPrize === prize && cryptoFresh) send("claimPrize", { skipHack: false });
      }, prizeDelay);
    }
  };

  const autoPrizeStage = player => {
    if (!flags.skip && !flags.prize) return;
    const prize = entryFor(player.pendingPrizeIndex);
    if (!prize) return;
    const now = Date.now();
    if (questSkippable(prize)) {
      const prev = prizeAttempt && prizeAttempt.kind === "skip" ? prizeAttempt : null;
      if (!prev || (now - prev.at >= 400 && prev.sends < 4)) {
        prizeAttempt = { kind: "skip", at: now, sends: prev ? prev.sends + 1 : 1 };
        send("playerGetNewQuestion", {});
      }
      return;
    }
    if (!flags.prize || prize.type === "swap") return;
    const prev = prizeAttempt && prizeAttempt.kind === "pick" ? prizeAttempt : null;
    if (!prev || (now - prev.at >= 2000 && prev.sends < 3)) {
      prizeAttempt = { kind: "pick", at: now, sends: prev ? prev.sends + 1 : 1 };
      send("revealPrize", {});
      setTimeout(() => send("claimPrize", {}), prizeDelay);
    }
  };

  const tickPrizes = player => {
    if (player.stage !== "prize") prizeAttempt = null;
    else autoPrizeStage(player);
    const inPrize = stageIs(player, "prize");
    if (wasPrizeStage && !inPrize) {
      cryptoFresh = false;
      cryptoAttempt = null;
    }
    wasPrizeStage = inPrize;
    if (inPrize) autoCryptoStage(player);
  };

  const tickAuto = () => {
    const player = me();
    if (player) tickPrizes(player);
    if (player && (kflags.serve || kflags.ask)) tickCafe(player);
    if (flags.random || cflags.random || fflags.random || gflags.random) randomAnswerTick();
    if (flags.cont || cflags.cont || fflags.cont || gflags.cont) continueTick();
    if (fflags.fish) fishTick();
    if (fflags.reveal) fishRevealTick();
    if (fflags.skip) fishSkipTick();
  };

  const syncLoop = () => {
    const needed = flags.skip || flags.prize || flags.random || flags.cont
      || cflags.skip || cflags.prize || cflags.random || cflags.cont
      || fflags.fish || fflags.random || fflags.cont || fflags.reveal || fflags.skip
      || gflags.random || gflags.cont || kflags.serve || kflags.ask;
    if (!flags.random && !cflags.random && !fflags.random && !gflags.random) {
      answered = null;
      seenQuestion = null;
    }
    if (!flags.cont && !cflags.cont && !fflags.cont && !gflags.cont) contState = null;
    if (!fflags.fish) lastPress = null;
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

  const cryptoStatus = () => ({ reveal: auto, skip: cflags.skip, prize: cflags.prize, random: cflags.random, cont: cflags.cont });

  const handlePrize = prize => {
    if (destroyed) return;
    lastPrize = prize;
    cryptoFresh = true;
    cryptoAttempt = null;
    if (auto) paint(prize);
  };

  const handleHackOptions = options => {
    if (destroyed) return;
    lastHackOptions = options;
  };

  const handleGuessResult = result => {
    if (destroyed) return;
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

  const questStatus = () => ({ reveal: questAuto, skip: flags.skip, prize: flags.prize, random: flags.random, cont: flags.cont });

  const setQuestReveal = enabled => {
    questAuto = Boolean(enabled);
    const prize = questAuto ? questPrize() : null;
    if (prize) paintQuest(prize);
    return questAuto;
  };

  const api = {
    version: "0.13.0",
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
      randomAnswer: (enabled = true, delayMs) => {
        if (typeof delayMs === "number") answerDelay = Math.max(0, delayMs);
        return setCryptoFlag("random", enabled);
      },
      autoContinue: (enabled = true) => setCryptoFlag("cont", enabled),
      dualMode: (enabled = true) => {
        const on = Boolean(enabled);
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
      randomAnswer: (enabled = true, delayMs) => {
        if (typeof delayMs === "number") answerDelay = Math.max(0, delayMs);
        return setFlag("random", enabled);
      },
      autoContinue: (enabled = true) => setFlag("cont", enabled),
      dualAuto: (enabled = true) => {
        const on = Boolean(enabled);
        setQuestReveal(on);
        setFlag("skip", on);
        return questStatus();
      },
      dualMode: (enabled = true) => {
        const on = Boolean(enabled);
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
    cafe: {
      getState: cafeState,
      serveAll: () => {
        const player = me();
        return isCafePlayer(player) ? serveCustomers(player) : 0;
      },
      askQuestion,
      autoServe: (enabled = true) => setCafeFlag("serve", enabled),
      autoAsk: (enabled = true) => setCafeFlag("ask", enabled),
      dualMode: (enabled = true) => {
        kflags.serve = Boolean(enabled);
        kflags.ask = Boolean(enabled);
        syncLoop();
        return { serve: kflags.serve, ask: kflags.ask };
      },
      status: () => ({ serve: kflags.serve, ask: kflags.ask }),
    },
    general: {
      randomAnswer: (enabled = true, delayMs) => {
        if (typeof delayMs === "number") answerDelay = Math.max(0, delayMs);
        return setGeneralFlag("random", enabled);
      },
      autoContinue: (enabled = true) => setGeneralFlag("cont", enabled),
      status: () => ({ random: gflags.random, cont: gflags.cont }),
    },
    lobby: {
      packs: () => {
        const st = marketState();
        return st ? st.packs.map(p => ({ name: p.name, price: p.price, packId: p.packId })) : [];
      },
      tokens: () => {
        const st = marketState();
        return st && typeof st.userTokens === "number" ? st.userTokens : null;
      },
      buyPacks: (pack, amount) => lobbyLock(() => buyPacks(pack, amount)),
      blooks: () => {
        const st = blooksState();
        if (!st) return [];
        const catalog = blookCatalog(st);
        return st.userBlooks.filter(e => !isFakeEntry(e)).map(e => ({
          name: e.blook,
          quantity: e.quantity,
          sellPrice: e.sellPrice,
          rarity: catalog.get(e.blook) ? catalog.get(e.blook).rarity : null,
        }));
      },
      planSell: kind => sellPlan(kind),
      sellDuplicates: () => lobbyLock(() => sellBlooks("duplicates")),
      sellCommons: () => lobbyLock(() => sellBlooks("commons")),
      sellUncommonsAndBelow: () => lobbyLock(() => sellBlooks("uncommons")),
      unlockAll: (enabled = true) => setFakeUnlock(Boolean(enabled)),
      fakeUnlocked: () => fakeOn,
      diagnose: () => {
        const info = findCallServer();
        return { path: window.location.pathname, webpackGlobals: info.globals, runtimes: info.requires, cachedModules: info.cached, callServerFound: Boolean(info.fn), lastActionVia, marketPage: Boolean(marketState()), blooksPage: Boolean(blooksState()) };
      },
    },
    fish: {
      getState: fishState,
      getStage: () => {
        const st = fishState();
        return st ? st.stage : null;
      },
      getPrize: () => {
        const st = fishState();
        return st ? st.prize : null;
      },
      getWeight: () => {
        const st = fishState();
        return st ? st.weight : null;
      },
      odds: fishOdds,
      removeTimeLimit: (enabled = true) => setTimeLimitRemoved(enabled),
      timeLimitRemoved: () => unlimitedMinutes,
      setMinutes,
      press: () => fishPress(["Ready", "Hooked", "Claim"]),
      claim: () => fishPress(["Claim"]),
      autoFish: (enabled = true) => setFishFlag("fish", enabled),
      autoReveal: (enabled = true) => setFishFlag("reveal", enabled),
      autoSkip: (enabled = true) => setFishFlag("skip", enabled),
      getDistractions: activeDistractions,
      randomAnswer: (enabled = true, delayMs) => {
        if (typeof delayMs === "number") answerDelay = Math.max(0, delayMs);
        return setFishFlag("random", enabled);
      },
      autoContinue: (enabled = true) => setFishFlag("cont", enabled),
      dualMode: (enabled = true) => {
        const on = Boolean(enabled);
        fflags.fish = on;
        setFishFlag("skip", on);
        return fishStatus();
      },
      status: fishStatus,
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
      destroyed = true;
      clearInterval(timers.attach);
      clearInterval(timers.loop);
      clearInterval(timers.refresh);
      timers.loop = null;
      if (observer) observer.disconnect();
      removeKeyHandler();
      removeHackClick();
      showDistractions();
      fontFaces.forEach(face => {
        try {
          document.fonts.delete(face);
        } catch (error) {
          return;
        }
      });
      fontFaces = [];
      removeMinutesGuard();
      if (unlimitedMinutes) setTimeLimitRemoved(false);
      if (fakeOn) setFakeUnlock(false);
      if (menuHost) menuHost.remove();
      menuHost = null;
      document.querySelectorAll("[data-blookjs]").forEach(node => node.remove());
      if (window.BlookJS === api) delete window.BlookJS;
    },
  };

  const MENU_CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: 'BlookJS Nunito', 'Nunito', system-ui, -apple-system, 'Segoe UI', sans-serif; }
    [hidden] { display: none !important; }
    .wrap { position: fixed; right: max(12px, env(safe-area-inset-right)); bottom: max(12px, env(safe-area-inset-bottom)); width: min(660px, calc(100vw - 24px)); z-index: 2147483000; color: #fafafa; }
    .panel { display: flex; flex-direction: column; height: min(414px, calc(100vh - 24px)); height: min(414px, calc(100dvh - 24px)); background: #18181b; border: 2px solid #27272a; border-radius: 12px; overflow: hidden; }
    .head { display: flex; flex: none; align-items: center; justify-content: space-between; padding: 8px 10px 8px 16px; background: #0bc2cf; color: #09090b; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
    .title { font-family: 'BlookJS Titan One', 'Titan One', 'Nunito', sans-serif; font-size: 20px; letter-spacing: 0.3px; color: #ffffff; }
    .ver { margin-left: 8px; font-size: 12px; font-weight: 800; color: #ffffff; }
    .controls { display: flex; gap: 8px; }
    .icon-btn { display: grid; place-items: center; width: 36px; height: 36px; border: 0; border-radius: 8px; background: #118891; color: #fafafa; cursor: pointer; }
    .main { flex: 1; min-height: 0; display: grid; grid-template-columns: 140px minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); grid-template-areas: "tabs content" "status content"; gap: 12px 18px; padding: 14px 16px 14px 14px; }
    .tabs { grid-area: tabs; display: flex; flex-direction: column; gap: 6px; }
    .tab { min-height: 36px; padding: 6px 12px; border: 0; border-bottom: 4px solid rgba(0, 0, 0, 0.28); border-radius: 10px; background: #27272a; color: #a1a1aa; font-size: 15px; font-weight: 800; white-space: nowrap; cursor: pointer; }
    .tab:hover { color: #fafafa; }
    .tab:active { transform: translateY(2px); border-bottom-width: 2px; }
    .tab[aria-selected="true"] { background: #0bc2cf; color: #ffffff; }
    .status { grid-area: status; align-self: stretch; min-height: 0; padding: 10px 12px; border-radius: 10px; background: #09090b; font-size: 12.5px; font-weight: 700; line-height: 1.35; color: #a1a1aa; overflow-y: auto; overflow-wrap: anywhere; scrollbar-width: thin; scrollbar-color: #3f3f46 transparent; }
    .content { grid-area: content; min-width: 0; min-height: 0; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #3f3f46 transparent; }
    .body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: auto auto; gap: 0 22px; align-content: start; }
    .body > .section:nth-child(1) { grid-column: 1; grid-row: 1 / span 2; }
    .body > .section:nth-child(2) { grid-column: 2; grid-row: 1; }
    .body > .section:nth-child(3) { grid-column: 2; grid-row: 2; }
    .body.two > .section:nth-child(2) { grid-column: 2; grid-row: 1 / span 2; }
    .field { width: 100%; min-height: 40px; margin: 0 0 8px; padding: 8px 12px; border: 2px solid #27272a; border-radius: 8px; background: #09090b; color: #fafafa; font-size: 14px; font-weight: 700; outline: none; }
    .field::placeholder { color: #71717a; font-weight: 600; }
    .field:focus { border-color: #0bc2cf; }
    .buttons.stack { grid-template-columns: minmax(0, 1fr); }
    .section-head { display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 30px; padding: 4px 2px; background: none; border: 0; color: #fafafa; font-size: 12px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; cursor: pointer; }
    .chev { display: grid; place-items: center; color: #a1a1aa; transition: transform 0.15s; }
    .section-head[aria-expanded="false"] .chev { transform: rotate(-90deg); }
    .section-body { padding-bottom: 4px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 46px; padding: 3px 2px; }
    .label { font-size: 14px; font-weight: 800; }
    .sub { margin-top: 1px; font-size: 11.5px; font-weight: 600; line-height: 1.3; color: #a1a1aa; }
    .switch { position: relative; flex: none; width: 46px; height: 26px; border: 0; border-radius: 999px; background: #3f3f46; cursor: pointer; transition: background 0.15s; }
    .switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fafafa; transition: transform 0.15s; }
    .switch[aria-checked="true"] { background: #7fbb43; }
    .switch[aria-checked="true"]::after { transform: translateX(20px); }
    .info { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0; padding: 0 2px 4px; font-size: 13px; }
    .info dt { font-weight: 700; color: #a1a1aa; }
    .info dd { margin: 0; text-align: right; font-weight: 800; overflow-wrap: anywhere; }
    .good { color: #7fbb43; }
    .bad { color: #dc2626; }
    .warn { color: #ffc000; }
    .muted { color: #a1a1aa; }
    .buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 2px 0 0; }
    .btn { min-height: 42px; padding: 8px 12px; border: 0; border-bottom: 4px solid rgba(0, 0, 0, 0.28); border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer; }
    .btn:active { transform: translateY(2px); border-bottom-width: 2px; }
    .btn.blue { background: #0bc2cf; color: #09090b; }
    .btn.green { background: #7fbb43; color: #09090b; }
    .btn.yellow { background: #ffc000; color: #09090b; }
    .btn.red { background: #dc2626; color: #fafafa; }
    .btn.purple { background: #9a49aa; color: #fafafa; }
    .pill { position: fixed; left: max(12px, env(safe-area-inset-left)); bottom: max(12px, env(safe-area-inset-bottom)); z-index: 2147483000; display: none; align-items: center; min-height: 46px; padding: 10px 18px; border: 0; border-bottom: 4px solid rgba(0, 0, 0, 0.28); border-radius: 10px; background: #0bc2cf; color: #ffffff; font-family: 'BlookJS Titan One', 'Titan One', 'Nunito', sans-serif; font-size: 18px; cursor: pointer; }
    .nofont .title, .nofont .pill { font-weight: 800; }
    .min .panel { display: none; }
    .min .pill { display: flex; }
    @media (max-width: 700px) {
      .panel { height: min(560px, calc(100vh - 24px)); height: min(560px, calc(100dvh - 24px)); }
      .main { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto; grid-template-areas: "tabs" "content" "status"; gap: 10px; padding: 12px; }
      .tabs { flex-direction: row; gap: 8px; overflow-x: auto; scrollbar-width: none; }
      .tab { flex: 0 0 auto; min-height: 44px; padding: 8px 14px; font-size: 13px; }
      .field { font-size: 16px; }
      .body.two > .section:nth-child(2) { grid-column: 1; grid-row: auto; }
      .body { grid-template-columns: minmax(0, 1fr); }
      .body > .section:nth-child(1), .body > .section:nth-child(2), .body > .section:nth-child(3) { grid-column: 1; grid-row: auto; }
      .status { align-self: auto; min-height: 44px; max-height: 84px; }
    }
  `;

  const ICON_MINUS = '<path d="M5 12h14"/>';
  const ICON_CLOSE = '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>';
  const ICON_CHEVRON = '<path d="m6 9 6 6 6-6"/>';

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
    const closeBtn = el("button", "icon-btn");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.innerHTML = svg(ICON_CLOSE, 18);
    const controls = el("div", "controls");
    controls.append(minBtn, closeBtn);
    head.append(titleBox, controls);

    const pill = el("button", "pill");
    pill.type = "button";
    pill.setAttribute("aria-label", "Open BlookJS");
    pill.textContent = "BlookJS";

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
        const message = set(!get());
        setStatus(typeof message === "string" ? message : label + (get() ? " on" : " off"));
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
        toggleRow("Dual Mode", "Auto skip and auto prize", () => {
          const st = questStatus();
          return st.skip && st.prize;
        }, v => api.quest.dualMode(v)),
        toggleRow("Auto Reveal", "Show prize on the pumpkins", () => questAuto, v => api.quest.autoReveal(v)),
        toggleRow("Auto Skip", "Skip losses and Nothing", () => flags.skip, v => api.quest.autoSkip(v)),
        toggleRow("Auto Prize", "Pick first pumpkin and claim", () => flags.prize, v => api.quest.autoPrize(v)),
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
        toggleRow("Dual Mode", "Auto skip and auto prize", () => {
          const st = cryptoStatus();
          return st.skip && st.prize;
        }, v => api.crypto.dualMode(v)),
        toggleRow("Auto Reveal", "Show prize on the boxes", () => auto, v => api.crypto.autoReveal(v)),
        toggleRow("Auto Skip", "Skip Nothing prizes", () => cflags.skip, v => api.crypto.autoSkip(v)),
        toggleRow("Auto Prize", "Claim prizes automatically", () => cflags.prize, v => api.crypto.autoPrize(v)),
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

    const fishPane = el("div", "body");
    const fishButtons = el("div", "buttons");
    fishButtons.append(
      actionButton("Reveal Contents", "blue", () => {
        const st = api.fish.getState();
        if (st && st.online) {
          if (!st.prize) return "No catch rolled yet";
          return "Next catch: " + fishPrizeText(st.prize) + (st.prize.rarity ? " (" + st.prize.rarity + ")" : "");
        }
        const odds = api.fish.odds().slice(0, 5);
        return "Odds: " + odds.map(o => o.name + " " + o.percent + "%").join(", ");
      }),
      actionButton("Cast / Reel", "green", () => {
        const result = api.fish.press();
        if (!result.sent) return "Not now: " + result.reason;
        if (result.stage === "Ready") return "Cast";
        if (result.stage === "Hooked") return "Reeled in";
        return "Claimed: " + fishPrizeText(result.prize);
      }),
      actionButton("Claim Prize", "purple", () => {
        const result = api.fish.claim();
        if (!result.sent) return "Not claimed: " + result.reason;
        return "Claimed: " + fishPrizeText(result.prize);
      }),
      actionButton("Remove time limit", "yellow", () => {
        const result = api.fish.removeTimeLimit(!api.fish.timeLimitRemoved());
        if (!result.enabled) return "Time limit restored (max 30)";
        return result.boxFound
          ? "Time limit removed - type any number of minutes"
          : "Time limit removed - open the start screen to use it";
      }),
    );
    fishPane.append(
      section("Automation", [
        toggleRow("Dual Mode", "Auto skip and auto fish", () => fflags.fish && fflags.skip, v => api.fish.dualMode(v)),
        toggleRow("Auto Reveal", "Show the next catch (online)", () => fflags.reveal, v => api.fish.autoReveal(v)),
        toggleRow("Auto Skip", "Hide distractions (online)", () => fflags.skip, v => api.fish.autoSkip(v)),
        toggleRow("Auto Fish", "Cast, reel and claim for you", () => fflags.fish, v => api.fish.autoFish(v)),
      ]),
      section("Status", [
        infoList([
          ["Stage", () => {
            const st = fishState();
            return { text: st ? st.stage : "-" };
          }],
          ["Prize", () => {
            const st = fishState();
            if (!st || !st.prize) return { text: "-", tone: "muted" };
            const tone = st.prize.rarity === "Trash" ? "muted" : st.prize.rarity === "Upgrade" || st.prize.rarity === "Special" ? "warn" : "good";
            return { text: fishPrizeText(st.prize), tone };
          }],
          ["Weight", () => {
            const st = fishState();
            return { text: st && typeof st.weight === "number" ? st.weight.toLocaleString() + " lbs" : "-" };
          }],
        ]),
      ]),
      section("Actions", [fishButtons]),
    );

    const field = (placeholder, mode) => {
      const input = el("input", "field");
      input.type = "text";
      input.placeholder = placeholder;
      input.autocomplete = "off";
      input.spellcheck = false;
      if (mode) input.inputMode = mode;
      ["keydown", "keyup", "keypress"].forEach(type => input.addEventListener(type, event => event.stopPropagation()));
      return input;
    };

    const generalPane = el("div", "body two");
    generalPane.append(
      section("Automation", [
        toggleRow("Random Answer", "Works in any game mode", () => gflags.random, v => api.general.randomAnswer(v)),
        toggleRow("Auto Continue", "Press continue for you", () => gflags.cont, v => api.general.autoContinue(v)),
      ]),
      section("Status", [
        infoList([
          ["Game", () => {
            const t = document.title.replace(/\s*\|\s*Blooket.*$/i, "").trim();
            return { text: t || "-" };
          }],
          ["Question", () => {
            const info = readQuestion();
            if (!info) return { text: "-", tone: "muted" };
            return { text: info.done ? "Answered" : info.choices.length + " choices", tone: info.done ? "muted" : "good" };
          }],
        ]),
      ]),
    );

    const packInput = field("Robot Pack (Pack Name)");
    const amountInput = field("5 (Amount)", "numeric");
    const buyButtons = el("div", "buttons stack");
    buyButtons.append(
      actionButton("Buy", "green", async () => {
        const result = await lobbyLock(() => buyPacks(packInput.value, amountInput.value, setStatus));
        if (!result.ok) {
          return "Not bought: " + result.error + (result.bought ? " (bought " + result.bought + " first)" : "");
        }
        return "Bought " + result.bought + " x " + result.pack + " - " + result.opened + " blooks (" + result.fresh + " new), " + result.tokensLeft.toLocaleString() + " tokens left";
      }),
    );
    const sellButtons = el("div", "buttons stack");
    sellButtons.append(
      actionButton("Sell Duplicates", "red", () => askSell("duplicates", "duplicates, keeping one of each", setStatus)),
      actionButton("Sell Commons", "red", () => askSell("commons", "all commons", setStatus)),
      actionButton("Sell Uncommons and Below", "red", () => askSell("uncommons", "all uncommons and commons", setStatus)),
    );
    const lobbyPane = el("div", "body two");
    lobbyPane.append(
      section("Batch Buy", [
        packInput,
        amountInput,
        infoList([
          ["Tokens", () => {
            const st = marketState();
            return { text: st && typeof st.userTokens === "number" ? st.userTokens.toLocaleString() : "-" };
          }],
          ["Pack", () => {
            const st = marketState();
            if (!packInput.value.trim()) return { text: "-", tone: "muted" };
            const pack = st ? findPack(st, packInput.value) : null;
            return pack ? { text: pack.name + " - " + pack.price.toLocaleString(), tone: "good" } : { text: "not found", tone: "bad" };
          }],
          ["Total", () => {
            const st = marketState();
            const pack = st && packInput.value.trim() ? findPack(st, packInput.value) : null;
            const amount = Math.floor(Number(amountInput.value));
            if (!pack || !Number.isFinite(amount) || amount < 1) return { text: "-", tone: "muted" };
            const total = pack.price * amount;
            return { text: total.toLocaleString(), tone: typeof st.userTokens === "number" && total > st.userTokens ? "bad" : "good" };
          }],
        ]),
        buyButtons,
      ]),
      section("Blooks", [
        toggleRow("Unlock All (fake)", "Display only, the server still knows what you own", () => fakeOn, v => {
          const result = setFakeUnlock(v);
          if (!result.ok) return "Not changed: " + result.error;
          return result.enabled ? "Showing all " + result.added + " blooks you do not own as unlocked (display only)" : "Unlock All (fake) off";
        }),
        sellButtons,
      ]),
    );

    const cafeButtons = el("div", "buttons");
    cafeButtons.append(
      actionButton("Serve All", "green", () => {
        const player = me();
        if (!isCafePlayer(player)) return "Not in a Cafe game";
        const n = serveCustomers(player);
        return n ? "Sent orders for " + n + " customers" : "No customers waiting";
      }),
      actionButton("Ask Question", "blue", () => (askQuestion() ? "Asked a question" : "Not in a game")),
    );
    const cafePane = el("div", "body");
    cafePane.append(
      section("Automation", [
        toggleRow("Dual Mode", "Auto serve and auto ask", () => kflags.serve && kflags.ask, v => api.cafe.dualMode(v)),
        toggleRow("Auto Serve", "Serve every customer, no stock check", () => kflags.serve, v => api.cafe.autoServe(v)),
        toggleRow("Auto Ask", "Ask questions to restock food", () => kflags.ask, v => api.cafe.autoAsk(v)),
      ]),
      section("Status", [
        infoList([
          ["Money", () => {
            const st = cafeState();
            return { text: st ? st.money.toLocaleString() : "-" };
          }],
          ["Level", () => {
            const st = cafeState();
            return { text: st && st.level !== undefined ? String(st.level) : "-" };
          }],
          ["Customers", () => {
            const st = cafeState();
            return { text: st ? String(st.customers) : "-" };
          }],
          ["Stock", () => {
            const st = cafeState();
            return { text: st ? st.stock.toLocaleString() : "-", tone: st && st.stock === 0 ? "bad" : undefined };
          }],
          ["Busy", () => {
            const st = cafeState();
            return st && st.busySeconds > 0 ? { text: st.busySeconds + "s inspected", tone: "warn" } : { text: "-", tone: "muted" };
          }],
        ]),
      ]),
      section("Actions", [cafeButtons]),
    );

    const panes = { general: generalPane, lobby: lobbyPane, quest: questPane, crypto: cryptoPane, fish: fishPane, cafe: cafePane };
    const tabs = el("div", "tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-orientation", "vertical");
    const tabButtons = {};
    const select = name => {
      Object.keys(panes).forEach(key => {
        panes[key].hidden = key !== name;
        tabButtons[key].setAttribute("aria-selected", String(key === name));
      });
    };
    [["general", "General"], ["lobby", "Lobby"], ["quest", "Gold Quest"], ["crypto", "Crypto Hack"], ["fish", "Fishing Frenzy"], ["cafe", "Cafe"]].forEach(([key, label]) => {
      const tab = el("button", "tab", label);
      tab.type = "button";
      tab.setAttribute("role", "tab");
      tab.addEventListener("click", () => select(key));
      tabButtons[key] = tab;
      tabs.append(tab);
    });
    const pathName = String(window.location && window.location.pathname || "");
    select(/\/(market|blooks)(\/|$)/i.test(pathName) ? "lobby"
      : /fishing/i.test(document.title) ? "fish"
      : /crypto/i.test(document.title) ? "crypto"
      : /cafe/i.test(document.title) ? "cafe"
      : /quest/i.test(document.title) ? "quest"
      : "general");

    const content = el("div", "content");
    content.append(generalPane, lobbyPane, questPane, cryptoPane, fishPane, cafePane);
    const main = el("div", "main");
    main.append(tabs, content, status);
    panel.append(head, main);
    wrap.append(panel, pill);
    shadow.append(style, wrap);

    const setMin = value => wrap.classList.toggle("min", value);
    minBtn.addEventListener("click", () => setMin(true));
    closeBtn.addEventListener("click", () => api.destroy());
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

  const TITAN_B64 = "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";
  const NUNITO_B64 = "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";

  const FONT_FACES = [
    { family: "BlookJS Titan One", data: TITAN_B64, weight: "400" },
    { family: "BlookJS Nunito", data: NUNITO_B64, weight: "200 1000" },
  ];

  const loadFace = spec => {
    try {
      const raw = atob(spec.data);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
      const face = new FontFace(spec.family, bytes.buffer, { weight: spec.weight, style: "normal" });
      return face.load().then(() => {
        if (destroyed) return null;
        document.fonts.add(face);
        fontFaces.push(face);
        return face;
      }, () => null);
    } catch (error) {
      return Promise.resolve(null);
    }
  };

  const loadFonts = () => {
    if (typeof FontFace !== "function" || !document.fonts || typeof atob !== "function") return Promise.resolve(false);
    return Promise.all(FONT_FACES.map(loadFace)).then(faces => Boolean(faces[0]));
  };

  const start = () => {
    document.addEventListener("click", onHackClick, true);
    window.addEventListener("input", onMinutesInput, true);
    window.addEventListener("change", onMinutesInput, true);
    removeMinutesGuard = () => {
      window.removeEventListener("input", onMinutesInput, true);
      window.removeEventListener("change", onMinutesInput, true);
    };
    removeHackClick = () => document.removeEventListener("click", onHackClick, true);
    menuHost = buildMenu();
    document.body.appendChild(menuHost);
    window.addEventListener("keydown", onKey);
    removeKeyHandler = () => window.removeEventListener("keydown", onKey);
    timers.refresh = setInterval(() => refreshMenu(), 400);
    loadFonts().then(ok => {
      const wrap = menuHost && menuHost.shadowRoot && menuHost.shadowRoot.querySelector(".wrap");
      if (wrap && !ok) wrap.classList.add("nofont");
    });
  };

  observer = new MutationObserver(() => {
    if (unlimitedMinutes) {
      const box = minutesBox();
      if (box && box.hasAttribute("max")) box.removeAttribute("max");
    }
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
