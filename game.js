(() => {
  'use strict';

  const STORAGE_KEY = 'geoje-island-tycoon-save';
  const CAPACITY = 180;
  const MARKET_INTERVAL = 25;
  const TOWN_STEP = 25000;
  const BOSS_BUFF_DURATION = 10 * 60 * 1000;
  const CROPS = [
    { id: 'yuja', name: '유자', icon: '🍋', price: 1200, seedPrice: 400, upgradeCost: 3200, growSeconds: 18, fieldClass: 'yuja-plot' },
    { id: 'shiitake', name: '표고버섯', icon: '🍄', price: 1800, seedPrice: 650, upgradeCost: 4000, growSeconds: 12, fieldClass: 'shiitake-plot' },
    { id: 'aloe', name: '알로에', icon: '🌿', price: 950, seedPrice: 300, upgradeCost: 2800, growSeconds: 14, fieldClass: 'aloe-plot' },
    { id: 'bamboo', name: '죽순', icon: '🎋', price: 1450, seedPrice: 500, upgradeCost: 3500, growSeconds: 16, fieldClass: 'bamboo-plot' }
  ];
  const FISH = [
    { id: 'anchovy', name: '멸치', icon: '🐟', chance: 70, price: 500 },
    { id: 'filefish', name: '쥐치', icon: '🐠', chance: 20, price: 1400 },
    { id: 'seaBream', name: '도미', icon: '🐟', chance: 7, price: 4200 },
    { id: 'mullet', name: '숭어', icon: '🐟', chance: 2, price: 2600 },
    { id: 'cod', name: '대구', icon: '🐟', chance: 1, price: 6000 }
  ];
  const BOSSES = [
    { id: 'stoneTurtle', element: '땅', name: '스톤 터틀', title: '대지의 수호자', icon: '🐢', hp: 220, damage: 22, attack: '바위 강타', buff: '밭 수확량 +1개' },
    { id: 'jetDragon', element: '물', name: '제트 드래곤', title: '물의 수호자', icon: '🐉', hp: 360, damage: 30, attack: '제트 물줄기', buff: '작물 성장 시간 20% 단축' },
    { id: 'phoenix', element: '해', name: '피닉스 (불사조)', title: '태양의 수호자', icon: '🔥', hp: 540, damage: 38, attack: '태양 불꽃', buff: '판매가 20% 상승' },
    { id: 'lightningDog', element: '비구름', name: '라이트닝 도그', title: '비구름의 수호자', icon: '🐕', hp: 800, damage: 46, attack: '번개 돌진', buff: '낚시 20% 확률로 같은 물고기 1마리 추가' }
  ];
  const RECIPES = [
    { id: 'yujaZest', name: '유자제스트', icon: '🍋', unit: '팩', price: 2200, seconds: 6, inputs: { yuja: 1 } },
    { id: 'mushroomPasta', name: '포고버섯 파스타', icon: '🍝', unit: '접시', price: 6900, seconds: 14, inputs: { shiitake: 2, yuja: 1 } },
    { id: 'yujaFinancier', name: '유자 휘낭시에', icon: '🧁', unit: '개', price: 4100, seconds: 12, inputs: { yuja: 2 } },
    { id: 'bambooRice', name: '죽순밥', icon: '🍚', unit: '그릇', price: 6200, seconds: 10, inputs: { bamboo: 2, shiitake: 1 } },
    { id: 'yujaAde', name: '유자에이드', icon: '🥤', unit: '잔', price: 3200, seconds: 8, inputs: { yuja: 1, aloe: 1 } }
  ];
  const LEGACY_RECIPE_MAP = { yujaTea: 'yujaZest', aloeJuice: 'yujaAde', shiitakeSoup: 'mushroomPasta', islandRice: 'bambooRice' };
  const TRAITS = {
    gold: { name: '금', multiplier: 2 },
    diamond: { name: '다이아', multiplier: 3 },
    rainbow: { name: '레인보우', multiplier: 5 },
    galaxy: { name: '겔럭시', multiplier: 10 }
  };
  const $ = (id) => document.getElementById(id);
  let migratedLegacyBossBuffs = false;

  function newGame() {
    const levels = {}, stock = {}, seeds = {}, plots = {}, foods = {}, fish = {};
    CROPS.forEach((crop) => {
      levels[crop.id] = 1;
      stock[crop.id] = 0;
      seeds[crop.id] = 2;
      plots[crop.id] = [];
    });
    RECIPES.forEach((recipe) => { foods[recipe.id] = 0; });
    FISH.forEach((item) => { fish[item.id] = 0; });
    return { money: 8000, levels, stock, seeds, plots, foods, fish, orders: [], bossBuffs: {}, battle: null, pendingBonus: 0, soldValue: 0, soldUnits: 0, activity: ['거제 섬마을에 첫 농장이 문을 열었습니다.'] };
  }

  function loadGame() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || typeof saved !== 'object') return newGame();
      const fresh = newGame();
      fresh.money = Math.max(0, Number(saved.money) || 0);
      fresh.pendingBonus = Math.max(0, Number(saved.pendingBonus) || 0);
      fresh.soldValue = Math.max(0, Number(saved.soldValue) || 0);
      fresh.soldUnits = Math.max(0, Number(saved.soldUnits) || 0);
      RECIPES.forEach((recipe) => {
        fresh.foods[recipe.id] = Math.max(0, Math.floor(Number(saved.foods && saved.foods[recipe.id]) || 0));
      });
      FISH.forEach((item) => {
        fresh.fish[item.id] = Math.max(0, Math.floor(Number(saved.fish && saved.fish[item.id]) || 0));
      });
      if (saved.bossBuffs && typeof saved.bossBuffs === 'object') {
        BOSSES.forEach((boss) => {
          const expiresAt = Number(saved.bossBuffs[boss.id]);
          if (Number.isFinite(expiresAt) && expiresAt > 0) fresh.bossBuffs[boss.id] = expiresAt;
        });
      } else if (Array.isArray(saved.defeatedBosses)) {
        BOSSES.forEach((boss) => {
          if (saved.defeatedBosses.includes(boss.id)) {
            fresh.bossBuffs[boss.id] = Date.now() + BOSS_BUFF_DURATION;
            migratedLegacyBossBuffs = true;
          }
        });
      }
      if (saved.battle && typeof saved.battle === 'object') {
        const boss = BOSSES.find((item) => item.id === saved.battle.bossId);
        const bossHp = Number(saved.battle.bossHp);
        const playerHp = Number(saved.battle.playerHp);
        if (boss && bossHp > 0 && playerHp > 0) {
          fresh.battle = {
            bossId: boss.id,
            bossHp: Math.min(boss.hp, bossHp),
            playerHp: Math.min(Number(saved.battle.playerMaxHp) || 100, playerHp),
            playerMaxHp: Math.min(10000, Math.max(1, Number(saved.battle.playerMaxHp) || 100)),
            playerAttack: Math.min(1000, Math.max(1, Number(saved.battle.playerAttack) || 48)),
            log: typeof saved.battle.log === 'string' ? saved.battle.log : '전투를 이어가세요.'
          };
        }
      }
      Object.entries(LEGACY_RECIPE_MAP).forEach(([oldId, newId]) => {
        fresh.foods[newId] += Math.max(0, Math.floor(Number(saved.foods && saved.foods[oldId]) || 0));
      });
      if (Array.isArray(saved.orders)) {
        fresh.orders = saved.orders.filter((order) => {
          const recipeId = LEGACY_RECIPE_MAP[order && order.recipeId] || (order && order.recipeId);
          return order && RECIPES.some((recipe) => recipe.id === recipeId) && Number.isFinite(Number(order.startAt)) && Number.isFinite(Number(order.completesAt));
        }).slice(0, 3).map((order) => ({ recipeId: LEGACY_RECIPE_MAP[order.recipeId] || order.recipeId, startAt: Number(order.startAt), completesAt: Number(order.completesAt) }));
      }
      CROPS.forEach((crop) => {
        fresh.levels[crop.id] = Math.max(1, Math.floor(Number(saved.levels && saved.levels[crop.id]) || 1));
        fresh.stock[crop.id] = Math.max(0, Math.floor(Number(saved.stock && saved.stock[crop.id]) || 0));
        if (saved.seeds && Object.prototype.hasOwnProperty.call(saved.seeds, crop.id)) {
          fresh.seeds[crop.id] = Math.max(0, Math.floor(Number(saved.seeds[crop.id]) || 0));
        }
        if (saved.plots && Array.isArray(saved.plots[crop.id])) {
          fresh.plots[crop.id] = saved.plots[crop.id]
            .filter((plot) => plot && Number.isFinite(Number(plot.plantedAt)))
            .map((plot) => ({ plantedAt: Number(plot.plantedAt), trait: TRAITS[plot.trait] ? plot.trait : null }))
            .slice(0, 6);
        }
      });
      if (Array.isArray(saved.activity)) fresh.activity = saved.activity.filter((entry) => typeof entry === 'string').slice(0, 5);
      return fresh;
    } catch { return newGame(); }
  }

  let state = loadGame();
  let featuredIndex = 0;
  let marketSecondsLeft = MARKET_INTERVAL;
  let toastTimer = null;
  let activeBossBuffs = new Set(BOSSES.filter((boss) => Number(state.bossBuffs[boss.id]) > Date.now()).map((boss) => boss.id));

  CROPS.forEach((crop) => {
    const field = document.querySelector('.' + crop.fieldClass);
    const slots = document.createElement('div');
    slots.className = 'plot-slots';
    slots.id = 'plots-' + crop.id;
    field.appendChild(slots);
  });
  document.querySelector('.auto-badge').innerHTML = '<i></i> 직접 심고 길러 수확';
  const traitNote = document.createElement('p');
  traitNote.className = 'trait-rates';
  traitNote.textContent = '일반 38.46% · 금 23.08% · 다이아 15.38% · 레인보우 15.38% · 겔럭시 7.69% (입력한 비율을 정규화했어요).';
  document.querySelector('.shop-card').insertBefore(traitNote, document.querySelector('.shop-list'));

  function saveGame() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { /* The game remains playable when local storage is unavailable. */ }
  }
  function money(value) { return '₩' + Math.floor(value).toLocaleString('ko-KR'); }
  function totalStock() {
    const raw = CROPS.reduce((sum, crop) => sum + state.stock[crop.id], 0);
    const withFood = RECIPES.reduce((sum, recipe) => sum + state.foods[recipe.id], raw);
    return FISH.reduce((sum, item) => sum + state.fish[item.id], withFood);
  }
  function farmLevelTotal() { return CROPS.reduce((sum, crop) => sum + state.levels[crop.id], 0); }
  function hasBossBuff(bossId) { return Number(state.bossBuffs[bossId]) > Date.now(); }
  function remainingTime(expiresAt) {
    const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    const minutes = Math.floor(seconds / 60);
    return minutes ? minutes + '분 ' + (seconds % 60) + '초' : seconds + '초';
  }
  function saleMultiplier() { return hasBossBuff('phoenix') ? 1.2 : 1; }
  function sellingPrice(basePrice) { return Math.floor(basePrice * saleMultiplier()); }
  function playerBattleStats() {
    const farmProgress = Math.max(0, farmLevelTotal() - CROPS.length);
    const townProgress = Math.max(0, townLevel() - 1);
    return {
      maxHp: 100 + farmProgress * 25 + townProgress * 10,
      attack: Math.min(160, 24 + farmLevelTotal() * 6 + Math.floor(townProgress / 2) * 5)
    };
  }
  function plotCapacity(crop) { return Math.min(6, state.levels[crop.id] + 1); }
  function growDuration(crop) {
    const guardianSpeed = hasBossBuff('jetDragon') ? .8 : 1;
    return crop.growSeconds * 1000 * Math.pow(.94, state.levels[crop.id] - 1) * guardianSpeed;
  }
  function isReady(crop, plot) { return Date.now() - plot.plantedAt >= growDuration(crop); }
  function readyCount(crop) { return state.plots[crop.id].filter((plot) => isReady(crop, plot)).length; }
  function upgradeCost(crop) { return Math.floor(crop.upgradeCost * Math.pow(1.62, state.levels[crop.id] - 1)); }
  function currentPrice(crop) {
    const marketPrice = crop.price + (featuredIndex === CROPS.indexOf(crop) ? Math.ceil(crop.price * .25 / 10) * 10 : 0);
    return sellingPrice(marketPrice);
  }
  function saleEstimate() {
    const rawValue = CROPS.reduce((sum, crop) => sum + state.stock[crop.id] * currentPrice(crop), state.pendingBonus);
    const foodValue = RECIPES.reduce((sum, recipe) => sum + state.foods[recipe.id] * sellingPrice(recipe.price), rawValue);
    return FISH.reduce((sum, item) => sum + state.fish[item.id] * sellingPrice(item.price), foodValue);
  }
  function townLevel() { return Math.min(99, Math.floor(state.soldValue / TOWN_STEP) + 1); }
  function hasIngredients(recipe) {
    return Object.entries(recipe.inputs).every(([cropId, amount]) => state.stock[cropId] >= amount);
  }

  function renderWorkshop() {
    const orders = state.orders;
    $('workshop-queue-count').textContent = '대기 ' + orders.length + '/3';
    const orderList = $('workshop-orders');
    orderList.replaceChildren();
    orders.forEach((order, index) => {
      const recipe = RECIPES.find((item) => item.id === order.recipeId);
      const chip = document.createElement('span');
      chip.className = 'workshop-order';
      chip.textContent = (index === 0 ? '제조 중 · ' : '대기 · ') + recipe.name;
      orderList.appendChild(chip);
    });
    const current = orders[0];
    if (!current) {
      $('workshop-status').textContent = '공방 준비 완료';
      $('workshop-progress').style.width = '0%';
      return;
    }
    const recipe = RECIPES.find((item) => item.id === current.recipeId);
    const now = Date.now();
    const duration = current.completesAt - current.startAt;
    const progress = Math.max(0, Math.min(100, (now - current.startAt) / duration * 100));
    const remaining = Math.max(0, Math.ceil((current.completesAt - now) / 1000));
    $('workshop-status').textContent = now < current.startAt
      ? recipe.name + ' 제조 대기'
      : recipe.name + ' 제조 중 · ' + remaining + '초';
    $('workshop-progress').style.width = progress + '%';
  }

  function makePlotSlot(crop, kind, symbol, label, action, trait) {
    const element = document.createElement(action ? 'button' : 'div');
    element.className = 'plot-slot ' + kind + (trait && TRAITS[trait] ? ' trait-' + trait : '');
    element.setAttribute('aria-label', crop.name + ' ' + label);
    if (action) {
      element.type = 'button';
      element.dataset.action = action;
      element.dataset.crop = crop.id;
    }
    const icon = document.createElement('span');
    icon.className = 'plot-symbol';
    icon.textContent = symbol;
    const caption = document.createElement('small');
    caption.textContent = label;
    element.append(icon, caption);
    if (trait && TRAITS[trait]) {
      const tag = document.createElement('b');
      tag.className = 'trait-tag';
      tag.textContent = TRAITS[trait].name;
      element.appendChild(tag);
    }
    return element;
  }

  function renderPlots() {
    CROPS.forEach((crop) => {
      const slots = $('plots-' + crop.id);
      slots.replaceChildren();
      const plants = state.plots[crop.id];
      for (let index = 0; index < plotCapacity(crop); index += 1) {
        const plant = plants[index];
        if (!plant) {
          slots.appendChild(makePlotSlot(crop, 'empty', '+', '심기', 'plant'));
          continue;
        }
        const elapsed = Math.max(0, Date.now() - plant.plantedAt);
        const duration = growDuration(crop);
        const progress = Math.min(100, elapsed / duration * 100);
        const remaining = Math.max(0, Math.ceil((duration - elapsed) / 1000));
        if (progress >= 100) {
          slots.appendChild(makePlotSlot(crop, 'ready', crop.icon, '수확!', 'harvest', plant.trait));
        } else {
          const icon = progress > 45 ? crop.icon : '🌱';
          const slot = makePlotSlot(crop, 'growing', icon, remaining + '초', null, plant.trait);
          const bar = document.createElement('span');
          bar.className = 'growth-bar';
          const fill = document.createElement('i');
          fill.style.width = progress + '%';
          bar.appendChild(fill);
          slot.appendChild(bar);
          slots.appendChild(slot);
        }
      }
    });
  }

  function renderActivity() {
    const list = $('activity-list');
    list.replaceChildren();
    state.activity.slice(0, 4).forEach((entry) => {
      const item = document.createElement('li');
      item.textContent = entry;
      list.appendChild(item);
    });
  }

  function renderFishing() {
    const list = $('fish-list');
    list.replaceChildren();
    FISH.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'fish-row';
      const icon = document.createElement('span');
      icon.className = 'fish-icon';
      icon.textContent = item.icon;
      const details = document.createElement('div');
      details.className = 'fish-details';
      const name = document.createElement('strong');
      name.textContent = item.name;
      const odds = document.createElement('small');
      odds.textContent = '출현 ' + item.chance + '% · ' + money(sellingPrice(item.price)) + '/마리';
      details.append(name, odds);
      const count = document.createElement('b');
      count.className = 'fish-count';
      count.textContent = state.fish[item.id].toLocaleString('ko-KR') + '마리';
      row.append(icon, details, count);
      list.appendChild(row);
    });
    $('fish-button').disabled = totalStock() >= CAPACITY;
  }

  function renderBosses() {
    const grid = $('boss-grid');
    grid.replaceChildren();
    BOSSES.forEach((boss) => {
      const expiresAt = Number(state.bossBuffs[boss.id]) || 0;
      const buffActive = expiresAt > Date.now();
      const buffExpired = expiresAt > 0 && !buffActive;
      const active = state.battle && state.battle.bossId === boss.id;
      const card = document.createElement('article');
      card.className = 'boss-card' + (buffActive ? ' boss-card-buffed' : '') + (active ? ' boss-card-active' : '');
      const top = document.createElement('div');
      top.className = 'boss-card-top';
      const icon = document.createElement('span');
      icon.className = 'boss-card-icon';
      icon.textContent = boss.icon;
      const title = document.createElement('div');
      const element = document.createElement('small');
      element.textContent = boss.element + ' · ' + boss.title;
      const name = document.createElement('h3');
      name.textContent = boss.name;
      title.append(element, name);
      top.append(icon, title);
      const buff = document.createElement('p');
      buff.className = 'boss-card-buff';
      buff.textContent = '승리 버프 · ' + boss.buff;
      const stats = document.createElement('small');
      stats.className = 'boss-card-stats';
      stats.textContent = '체력 ' + boss.hp + ' · 반격 ' + boss.damage;
      const status = document.createElement('span');
      status.className = 'boss-card-status';
      status.dataset.bossTimer = boss.id;
      status.textContent = buffActive ? '축복 활성 · ' + remainingTime(expiresAt) : active ? '전투 중' : buffExpired ? '축복 만료' : '미도전';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'boss-challenge-button';
      button.dataset.boss = boss.id;
      button.disabled = buffActive || Boolean(state.battle);
      button.textContent = buffActive ? '버프 유지 중' : active ? '전투 중' : state.battle ? '전투 종료 후 도전' : buffExpired ? '다시 도전' : '도전하기';
      card.append(top, buff, stats, status, button);
      grid.appendChild(card);
    });

    const buffs = $('boss-buffs');
    buffs.replaceChildren();
    const earned = BOSSES.filter((boss) => hasBossBuff(boss.id));
    if (!earned.length) {
      const empty = document.createElement('span');
      empty.className = 'boss-buff-empty';
      empty.textContent = '현재 활성화된 버프가 없어요.';
      buffs.appendChild(empty);
    } else earned.forEach((boss) => {
      const tag = document.createElement('span');
      tag.className = 'boss-buff-tag';
      tag.dataset.buffTimer = boss.id;
      tag.textContent = boss.icon + ' ' + boss.buff + ' · ' + remainingTime(state.bossBuffs[boss.id]);
      buffs.appendChild(tag);
    });

    const playerStats = playerBattleStats();
    $('boss-status').textContent = state.battle
      ? BOSSES.find((boss) => boss.id === state.battle.bossId).name + ' 보스와 전투 중이에요. 농장 업그레이드로 공격력과 체력을 키워보세요.'
      : earned.length === BOSSES.length
        ? '네 신수의 축복이 모두 활성화됐어요. 각 버프는 승리 후 10분 동안 유지돼요!'
        : '승리 버프는 10분 동안 유지돼요. 농장 업그레이드와 마을 성장으로 전투 능력을 키우세요. 현재 공격력 ' + playerStats.attack + ' · 최대 체력 ' + playerStats.maxHp;

    const arena = $('boss-battle');
    if (!state.battle) {
      arena.hidden = true;
      return;
    }
    const boss = BOSSES.find((item) => item.id === state.battle.bossId);
    arena.hidden = false;
    $('battle-element').textContent = boss.element + ' · ' + boss.title;
    $('battle-boss-name').textContent = boss.icon + ' ' + boss.name;
    $('boss-hp-label').textContent = Math.ceil(state.battle.bossHp) + ' / ' + boss.hp;
    $('boss-hp-bar').style.width = Math.max(0, state.battle.bossHp / boss.hp * 100) + '%';
    $('player-hp-label').textContent = Math.ceil(state.battle.playerHp) + ' / ' + state.battle.playerMaxHp;
    $('player-hp-bar').style.width = Math.max(0, state.battle.playerHp / state.battle.playerMaxHp * 100) + '%';
    $('battle-player-stats').textContent = '공격력 ' + state.battle.playerAttack;
    $('boss-battle-log').textContent = state.battle.log;
  }

  function refreshBossBuffs() {
    const current = new Set(BOSSES.filter((boss) => hasBossBuff(boss.id)).map((boss) => boss.id));
    const expired = [...activeBossBuffs].filter((bossId) => !current.has(bossId));
    activeBossBuffs = current;
    if (!expired.length) {
      BOSSES.forEach((boss) => {
        const expiresAt = Number(state.bossBuffs[boss.id]) || 0;
        if (expiresAt <= Date.now()) return;
        const status = document.querySelector('[data-boss-timer="' + boss.id + '"]');
        if (status) status.textContent = '축복 활성 · ' + remainingTime(expiresAt);
        const tag = document.querySelector('[data-buff-timer="' + boss.id + '"]');
        if (tag) tag.textContent = boss.icon + ' ' + boss.buff + ' · ' + remainingTime(expiresAt);
      });
      return;
    }
    expired.forEach((bossId) => {
      const boss = BOSSES.find((item) => item.id === bossId);
      addActivity(boss.name + ' 버프 시간이 끝났어요.');
    });
    saveGame();
    render();
    showToast(expired.length === 1 ? BOSSES.find((boss) => boss.id === expired[0]).name + ' 버프가 끝났어요.' : expired.length + '개 보스 버프가 끝났어요.');
  }

  function render() {
    $('money-value').textContent = money(state.money);
    $('sold-units').innerHTML = state.soldUnits.toLocaleString('ko-KR') + '<i>개</i>';
    $('farm-levels').innerHTML = farmLevelTotal().toLocaleString('ko-KR') + '<i>단계</i>';
    $('total-earnings').textContent = money(state.soldValue);
    CROPS.forEach((crop) => {
      const level = state.levels[crop.id];
      $('level-' + crop.id).textContent = level;
      $('stock-' + crop.id).textContent = state.stock[crop.id].toLocaleString('ko-KR');
      $('price-' + crop.id).textContent = money(currentPrice(crop));
      $('yield-' + crop.id).textContent = (level + (hasBossBuff('stoneTurtle') ? 1 : 0)) + '개 / 밭';
      $('upgrade-cost-' + crop.id).textContent = money(upgradeCost(crop));
      $('seed-' + crop.id).textContent = state.seeds[crop.id];
      $('seed-price-' + crop.id).textContent = money(crop.seedPrice);
      const harvestButton = document.querySelector('#farm-grid [data-action="harvest"][data-crop="' + crop.id + '"]');
      harvestButton.disabled = readyCount(crop) === 0;
      document.querySelector('#farm-grid [data-action="upgrade"][data-crop="' + crop.id + '"]').disabled = state.money < upgradeCost(crop);
      document.querySelector('[data-action="buy-seed"][data-crop="' + crop.id + '"]').disabled = state.money < crop.seedPrice;
    });
    RECIPES.forEach((recipe) => {
      $('food-' + recipe.id).textContent = state.foods[recipe.id].toLocaleString('ko-KR');
      const priceLabel = document.querySelector('[data-food-price="' + recipe.id + '"]');
      if (priceLabel) priceLabel.textContent = money(sellingPrice(recipe.price));
      document.querySelector('[data-action="craft"][data-recipe="' + recipe.id + '"]').disabled = state.orders.length >= 3 || !hasIngredients(recipe);
    });
    const used = totalStock();
    $('storage-count').textContent = used.toLocaleString('ko-KR');
    $('storage-progress').style.width = Math.min(100, used / CAPACITY * 100) + '%';
    $('sell-value').textContent = money(saleEstimate());
    document.querySelector('.storage-caption').textContent = state.pendingBonus > 0
      ? '특성 작물 보너스 ' + money(state.pendingBonus) + '이 판매 예상액에 포함됐어요.'
      : '바구니가 가득 차기 전에 장터에 판매하세요.';
    $('sell-button').disabled = used === 0;
    const featured = CROPS[featuredIndex];
    $('demand-icon').textContent = featured.icon;
    $('demand-name').textContent = featured.name;
    $('demand-countdown').textContent = marketSecondsLeft + '초';
    $('demand-progress').style.width = marketSecondsLeft / MARKET_INTERVAL * 100 + '%';
    const level = townLevel();
    const threshold = (level - 1) * TOWN_STEP;
    $('town-level').textContent = level;
    $('town-level-inline').textContent = level;
    $('town-progress-label').textContent = money(state.soldValue - threshold) + ' / ' + money(TOWN_STEP);
    $('town-progress').style.width = Math.min(100, (state.soldValue - threshold) / TOWN_STEP * 100) + '%';
    $('town-caption').textContent = level >= 99 ? '섬에서 가장 번성한 마을이 되었어요!' : level === 1 ? '첫 판매를 시작해 섬마을을 키워보세요.' : '다음 마을 레벨까지 ' + money(level * TOWN_STEP - state.soldValue) + ' 남았어요.';
    renderActivity();
    renderPlots();
    renderWorkshop();
    renderFishing();
    renderBosses();
  }

  function addActivity(message) {
    state.activity.unshift(message);
    state.activity = state.activity.slice(0, 5);
  }
  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2100);
  }

  function rollTrait() {
    const chance = Math.random();
    if (chance < 50 / 130) return null;
    if (chance < 80 / 130) return 'gold';
    if (chance < 100 / 130) return 'diamond';
    if (chance < 120 / 130) return 'rainbow';
    return 'galaxy';
  }

  function buySeed(crop) {
    if (state.money < crop.seedPrice) { showToast('씨앗을 살 자금이 조금 더 필요해요.'); return; }
    state.money -= crop.seedPrice;
    state.seeds[crop.id] += 1;
    addActivity(crop.name + ' 씨앗을 상점에서 샀어요.');
    saveGame();
    render();
    showToast(crop.name + ' 씨앗을 구매했어요.');
  }

  function plant(crop) {
    if (state.seeds[crop.id] < 1) { showToast('씨앗이 없어요. 농자재 상점에서 먼저 구매해 주세요.'); return; }
    if (state.plots[crop.id].length >= plotCapacity(crop)) { showToast(crop.name + ' 밭이 꽉 찼어요. 자란 작물을 수확해 주세요.'); return; }
    state.seeds[crop.id] -= 1;
    const trait = rollTrait();
    state.plots[crop.id].push({ plantedAt: Date.now(), trait });
    addActivity(crop.name + ' 씨앗을 밭에 심었어요.' + (trait ? ' ' + TRAITS[trait].name + ' 특성이 생겼어요!' : ''));
    saveGame();
    render();
    showToast(trait ? crop.name + '에 ' + TRAITS[trait].name + ' 특성이 생겼어요!' : crop.name + ' 씨앗을 심었어요. 다 자라면 수확할 수 있어요!');
  }

  function fishOnce() {
    if (totalStock() >= CAPACITY) { showToast('수확 바구니가 가득 찼어요. 장터에 먼저 판매해 주세요.'); return; }
    const roll = Math.random() * 100;
    let limit = 0;
    const caught = FISH.find((item) => {
      limit += item.chance;
      return roll < limit;
    }) || FISH[FISH.length - 1];
    const available = CAPACITY - totalStock();
    const caughtCount = hasBossBuff('lightningDog') && available > 1 && Math.random() < .2 ? 2 : 1;
    state.fish[caught.id] += caughtCount;
    addActivity('거제 앞바다에서 ' + caught.name + ' ' + caughtCount + '마리를 낚았어요.');
    saveGame();
    render();
    showToast(caught.name + ' ' + caughtCount + '마리를 낚았어요! 장터 시세 ' + money(sellingPrice(caught.price)) + '/마리');
  }

  function startBossFight(boss) {
    if (hasBossBuff(boss.id)) { showToast('이 보스의 버프가 ' + remainingTime(state.bossBuffs[boss.id]) + ' 더 유지돼요.'); return; }
    if (state.battle) { showToast('진행 중인 보스전을 먼저 마쳐주세요.'); return; }
    const stats = playerBattleStats();
    state.battle = { bossId: boss.id, bossHp: boss.hp, playerHp: stats.maxHp, playerMaxHp: stats.maxHp, playerAttack: stats.attack, log: boss.name + '이(가) 나타났어요. 공격 버튼을 눌러 전투하세요!' };
    addActivity(boss.name + '에게 도전했어요.');
    saveGame();
    render();
    showToast(boss.name + ' 보스전 시작!');
  }

  function attackBoss() {
    if (!state.battle) return;
    const boss = BOSSES.find((item) => item.id === state.battle.bossId);
    const damage = state.battle.playerAttack;
    state.battle.bossHp = Math.max(0, state.battle.bossHp - damage);
    if (state.battle.bossHp <= 0) {
      state.bossBuffs[boss.id] = Date.now() + BOSS_BUFF_DURATION;
      activeBossBuffs.add(boss.id);
      state.battle = null;
      addActivity(boss.name + '을(를) 물리쳐 10분 버프를 얻었어요.');
      saveGame();
      render();
      showToast(boss.name + ' 격파! ' + boss.buff + ' · 10분 동안 유지돼요.');
      return;
    }
    state.battle.playerHp = Math.max(0, state.battle.playerHp - boss.damage);
    state.battle.log = '내 공격 ' + damage + ' 피해! ' + boss.attack + ' 반격으로 ' + boss.damage + ' 피해를 받았어요.';
    if (state.battle.playerHp <= 0) {
      state.battle = null;
      addActivity(boss.name + '에게 패배했어요. 다시 도전할 수 있어요.');
      saveGame();
      render();
      showToast('전투에서 쓰러졌어요. 체력을 회복해 다시 도전하세요.');
      return;
    }
    saveGame();
    render();
  }

  function retreatBoss() {
    if (!state.battle) return;
    const boss = BOSSES.find((item) => item.id === state.battle.bossId);
    state.battle = null;
    addActivity(boss.name + ' 보스전에서 후퇴했어요.');
    saveGame();
    render();
    showToast('보스전에서 후퇴했어요.');
  }

  function queueCraft(recipe) {
    if (state.orders.length >= 3) { showToast('공방 제조 대기열이 가득 찼어요.'); return; }
    if (!hasIngredients(recipe)) { showToast('음식 제조에 필요한 작물이 부족해요.'); return; }
    const now = Date.now();
    const previous = state.orders[state.orders.length - 1];
    const startAt = previous ? Math.max(now, previous.completesAt) : now;
    Object.entries(recipe.inputs).forEach(([cropId, amount]) => { state.stock[cropId] -= amount; });
    state.orders.push({ recipeId: recipe.id, startAt, completesAt: startAt + recipe.seconds * 1000 });
    addActivity(recipe.name + ' 제조를 시작했어요.');
    saveGame();
    render();
    showToast(recipe.name + ' 제조를 시작했어요.');
  }

  function completeOrders() {
    const now = Date.now();
    const completed = [];
    while (state.orders.length && state.orders[0].completesAt <= now) {
      const order = state.orders.shift();
      const recipe = RECIPES.find((item) => item.id === order.recipeId);
      state.foods[recipe.id] += 1;
      completed.push(recipe.name);
      addActivity(recipe.name + ' 제조가 완료됐어요.');
    }
    if (completed.length) {
      saveGame();
      render();
      showToast(completed.join(', ') + ' 완성!');
    } else renderWorkshop();
  }

  function harvest(crop) {
    const ripe = readyCount(crop);
    if (!ripe) { showToast(crop.name + '이(가) 아직 자라고 있어요.'); return; }
    const available = CAPACITY - totalStock();
    if (available <= 0) { showToast('수확 바구니가 가득 찼어요. 장터에 먼저 판매해 주세요.'); return; }
    let harvested = 0;
    let units = 0;
    let bonus = 0;
    const foundTraits = {};
    const kept = [];
    state.plots[crop.id].forEach((plot) => {
      if (isReady(crop, plot) && units < available) {
        const guardianYield = state.levels[crop.id] + (hasBossBuff('stoneTurtle') ? 1 : 0);
        const plotYield = Math.min(guardianYield, available - units);
        units += plotYield;
        harvested += 1;
        if (plot.trait && TRAITS[plot.trait]) {
          bonus += plotYield * currentPrice(crop) * (TRAITS[plot.trait].multiplier - 1);
          foundTraits[plot.trait] = (foundTraits[plot.trait] || 0) + 1;
        }
      } else kept.push(plot);
    });
    state.plots[crop.id] = kept;
    state.stock[crop.id] += units;
    state.pendingBonus += bonus;
    const traitSummary = Object.keys(foundTraits).map((trait) => TRAITS[trait].name + ' ' + foundTraits[trait] + '개').join(', ');
    addActivity(crop.name + ' ' + units + '개 수확' + (traitSummary ? ' · ' + traitSummary : '') + '했어요.');
    saveGame();
    render();
    showToast(crop.name + ' ' + units + '개 수확 완료!' + (bonus ? ' 특성 보너스 ' + money(bonus) + ' 추가' : ''));
  }

  function upgrade(crop) {
    const cost = upgradeCost(crop);
    if (state.money < cost) { showToast('자금이 조금 더 필요해요.'); return; }
    state.money -= cost;
    state.levels[crop.id] += 1;
    addActivity(crop.name + ' 농장을 레벨 ' + state.levels[crop.id] + '로 키웠어요.');
    saveGame();
    render();
    showToast('밭이 넓어지고 ' + crop.name + ' 성장 속도와 수확량이 늘었어요.');
  }

  function sellAll() {
    const units = totalStock();
    if (!units) { showToast('판매할 작물, 물고기, 음식이 아직 없어요.'); return; }
    const revenue = saleEstimate();
    state.money += revenue;
    state.soldValue += revenue;
    state.soldUnits += units;
    state.pendingBonus = 0;
    CROPS.forEach((crop) => { state.stock[crop.id] = 0; });
    RECIPES.forEach((recipe) => { state.foods[recipe.id] = 0; });
    FISH.forEach((item) => { state.fish[item.id] = 0; });
    addActivity(units + '개를 장터에 팔아 ' + money(revenue) + '을 벌었어요.');
    saveGame();
    render();
    showToast(units + '개 판매 완료 · ' + money(revenue) + ' 획득!');
  }

  function runAction(button) {
    if (button.dataset.action === 'craft') {
      const recipe = RECIPES.find((item) => item.id === button.dataset.recipe);
      if (recipe) queueCraft(recipe);
      return;
    }
    const crop = CROPS.find((item) => item.id === button.dataset.crop);
    if (!crop) return;
    if (button.dataset.action === 'plant') plant(crop);
    if (button.dataset.action === 'harvest') harvest(crop);
    if (button.dataset.action === 'upgrade') upgrade(crop);
    if (button.dataset.action === 'buy-seed') buySeed(crop);
  }

  $('farm-grid').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (button) runAction(button);
  });
  document.querySelector('.field-rows').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (button) runAction(button);
  });
  document.querySelector('.shop-list').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action="buy-seed"]');
    if (button) runAction(button);
  });
  document.querySelector('.recipe-grid').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action="craft"]');
    if (button) runAction(button);
  });
  $('sell-button').addEventListener('click', sellAll);
  $('fish-button').addEventListener('click', fishOnce);
  $('boss-grid').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-boss]');
    if (!button) return;
    const boss = BOSSES.find((item) => item.id === button.dataset.boss);
    if (boss) startBossFight(boss);
  });
  $('boss-attack-button').addEventListener('click', attackBoss);
  $('boss-retreat-button').addEventListener('click', retreatBoss);
  $('restart-button').addEventListener('click', () => {
    if (!window.confirm('저장된 농장 진행 상황을 지우고 새로 시작할까요?')) return;
    state = newGame();
    activeBossBuffs = new Set();
    featuredIndex = 0;
    marketSecondsLeft = MARKET_INTERVAL;
    saveGame();
    render();
    showToast('새로운 섬마을 농장을 시작했어요.');
  });

  render();
  if (migratedLegacyBossBuffs) saveGame();
  setInterval(() => { renderPlots(); completeOrders(); refreshBossBuffs(); }, 1000);
  setInterval(() => {
    marketSecondsLeft -= 1;
    if (marketSecondsLeft <= 0) {
      featuredIndex = (featuredIndex + 1) % CROPS.length;
      marketSecondsLeft = MARKET_INTERVAL;
      render();
      showToast('장승포 장터의 인기 작물이 ' + CROPS[featuredIndex].name + '(으)로 바뀌었어요.');
    } else {
      $('demand-countdown').textContent = marketSecondsLeft + '초';
      $('demand-progress').style.width = marketSecondsLeft / MARKET_INTERVAL * 100 + '%';
    }
  }, 1000);
})();
