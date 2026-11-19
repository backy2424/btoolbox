// Bananagrams 单人版核心逻辑（同时支持浏览器与 Node 测试）
(function (root) {
  'use strict';

  // Scrabble 风格字母分值
  var LETTER_POINTS = {
    a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8,
    k: 5, l: 1, m: 3, n: 1, o: 1, p: 3, q: 10, r: 1, s: 1, t: 1,
    u: 1, v: 4, w: 4, x: 8, y: 4, z: 10
  };

  function shuffle(arr, rng) {
    rng = rng || Math.random;
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // 提取网格中所有横向/纵向连续字母串（长度 >= 2）
  function extractWords(grid) {
    var size = grid.length;
    var found = [];
    var r, c;

    for (r = 0; r < size; r++) {
      c = 0;
      while (c < size) {
        if (!grid[r][c]) { c++; continue; }
        var hs = c;
        while (c < size && grid[r][c]) c++;
        if (c - hs >= 2) {
          var hw = '', hcells = [];
          for (var k = hs; k < c; k++) {
            hw += grid[r][k];
            hcells.push({ r: r, c: k });
          }
          found.push({ word: hw, cells: hcells, dir: 'h' });
        }
      }
    }

    for (c = 0; c < size; c++) {
      r = 0;
      while (r < size) {
        if (!grid[r][c]) { r++; continue; }
        var vs = r;
        while (r < size && grid[r][c]) r++;
        if (r - vs >= 2) {
          var vw = '', vcells = [];
          for (var m = vs; m < r; m++) {
            vw += grid[m][c];
            vcells.push({ r: m, c: c });
          }
          found.push({ word: vw, cells: vcells, dir: 'v' });
        }
      }
    }
    return found;
  }

  function emptyGrid(size) {
    var g = [];
    for (var i = 0; i < size; i++) g.push(new Array(size).fill(null));
    return g;
  }

  // 尝试把 word 以 (r,c,dir) 放入 grid：
  // 要求每格为空或相同字母；除首词外至少复用一个已有字母（形成交叉）；
  // 且放置后网格中提取的每一个连续串都在词库 dict 中。
  // 成功则修改 grid 并返回 true，失败则回退并返回 false。
  function tryCommit(grid, word, r, c, dir, dict, isFirst) {
    var size = grid.length, k, rr, cc, cur, shared = 0;
    for (k = 0; k < word.length; k++) {
      rr = dir === 'v' ? r + k : r;
      cc = dir === 'h' ? c + k : c;
      if (rr < 0 || cc < 0 || rr >= size || cc >= size) return false;
      cur = grid[rr][cc];
      if (cur) {
        if (cur !== word.charAt(k)) return false;
        shared++;
      }
    }
    if (!isFirst && shared === 0) return false;

    var backup = grid.map(function (row) { return row.slice(); });
    for (k = 0; k < word.length; k++) {
      rr = dir === 'v' ? r + k : r;
      cc = dir === 'h' ? c + k : c;
      grid[rr][cc] = word.charAt(k);
    }
    var runs = extractWords(grid);
    var ok = runs.every(function (run) { return dict.has(run.word); });
    if (ok) return true;
    for (var i = 0; i < size; i++) grid[i] = backup[i]; // 回退
    return false;
  }

  // 构造式发牌：先在网格上实际搭出合法交叉词网，再把其中所有字母打乱作为手牌。
  // 因此手牌一定能还原成一个合法解（就是 solution 网格）。
  function buildSolution(count, dict, words, rng, boardSize) {
    rng = rng || Math.random;
    boardSize = boardSize || 13;
    var grid = emptyGrid(boardSize);
    var chosen = [];
    var order = shuffle(words, rng);

    // 第一个词放在中央（若词过长则以左边界对齐）
    var first = order[0];
    var mid = Math.floor(boardSize / 2);
    var startCol = Math.max(0, mid - Math.floor(first.length / 2));
    if (!tryCommit(grid, first, mid, startCol, 'h', dict, true)) {
      // 兜底：按原样直接写入，保证网格非空
      for (var fc = 0; fc < first.length && startCol + fc < boardSize; fc++) {
        grid[mid][startCol + fc] = first.charAt(fc);
      }
    }
    chosen.push(first);

    // 后续每个词必须复用已有字母形成交叉
    for (var oi = 1; oi < order.length && chosen.length < count; oi++) {
      var w = order[oi];
      var placed = false;
      // 枚举“词中某字母”对齐到“网格中相同字母”的所有位置
      for (var r = 0; r < boardSize && !placed; r++) {
        for (var c = 0; c < boardSize && !placed; c++) {
          if (!grid[r][c]) continue;
          for (var idx = 0; idx < w.length && !placed; idx++) {
            if (w.charAt(idx) !== grid[r][c]) continue;
            // 横向对齐
            if (tryCommit(grid, w, r, c - idx, 'h', dict, false)) { placed = true; break; }
            // 纵向对齐
            if (tryCommit(grid, w, r - idx, c, 'v', dict, false)) { placed = true; break; }
          }
        }
      }
      if (placed) chosen.push(w);
    }

    var tiles = [];
    grid.forEach(function (row) { row.forEach(function (ch) { if (ch) tiles.push(ch); }); });
    return { tiles: shuffle(tiles, rng), words: chosen.slice(), solution: grid, boardSize: boardSize };
  }

  // 对外发牌接口
  function deal(count, words, rng, dictArg, boardSize) {
    var dict = dictArg || new Set(words);
    return buildSolution(count, dict, words, rng || Math.random, boardSize || 13);
  }

  function wordPoints(word) {
    var sum = 0;
    for (var i = 0; i < word.length; i++) sum += (LETTER_POINTS[word.charAt(i)] || 0);
    return sum;
  }

  // 检查所有放置字母是否正交连通成一个整体
  function isConnected(grid) {
    var size = grid.length;
    var cells = [];
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) if (grid[r][c]) cells.push([r, c]);
    }
    if (cells.length <= 1) return true;
    var key = function (r, c) { return r + ',' + c; };
    var set = {};
    cells.forEach(function (p) { set[key(p[0], p[1])] = true; });
    var seen = {};
    var queue = [cells[0]];
    seen[key(cells[0][0], cells[0][1])] = true;
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (queue.length) {
      var cur = queue.shift();
      for (var d = 0; d < dirs.length; d++) {
        var nr = cur[0] + dirs[d][0], nc = cur[1] + dirs[d][1], k = key(nr, nc);
        if (set[k] && !seen[k]) { seen[k] = true; queue.push([nr, nc]); }
      }
    }
    return Object.keys(seen).length === cells.length;
  }

  // 校验网格。dict: Set；opts: { requireAllTiles, rackLeft, requireConnected }
  function validate(grid, dict, opts) {
    opts = opts || {};
    var size = grid.length;
    var placed = [];
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) if (grid[r][c]) placed.push({ r: r, c: c, ch: grid[r][c] });
    }

    var runs = extractWords(grid);
    var validWords = [], invalidWords = [];
    var inRun = {};
    runs.forEach(function (run) {
      run.cells.forEach(function (cell) { inRun[cell.r + ',' + cell.c] = true; });
      if (dict.has(run.word)) validWords.push(run);
      else invalidWords.push(run);
    });

    var orphans = placed.filter(function (p) { return !inRun[p.r + ',' + p.c]; });
    var connected = isConnected(grid);
    var score = 0;
    validWords.forEach(function (run) { score += wordPoints(run.word); });

    var errors = [];
    if (placed.length === 0) errors.push({ type: 'empty', text: '还没有放置任何字母' });
    if (invalidWords.length) {
      errors.push({
        type: 'invalid',
        text: '无效单词：' + invalidWords.map(function (w) { return w.word.toUpperCase(); }).join('、')
      });
    }
    if (orphans.length) {
      errors.push({ type: 'orphan', text: '有 ' + orphans.length + ' 个孤立的字母，需并入单词' });
    }
    if (opts.requireConnected && placed.length > 0 && !connected) {
      errors.push({ type: 'disconnected', text: '单词之间没有交叉连接' });
    }
    if (opts.requireAllTiles && opts.rackLeft > 0) {
      errors.push({ type: 'leftover', text: '还有 ' + opts.rackLeft + ' 个字母没用完' });
    }

    return {
      ok: errors.length === 0,
      errors: errors,
      validWords: validWords.map(function (w) { return w.word; }),
      invalidWords: invalidWords.map(function (w) { return w.word; }),
      score: score,
      connected: connected,
      placedCount: placed.length
    };
  }

  // 根据剩余字母，找出词库中可以拼出的词（按长度降序）
  function hints(rackLetters, dictWords, limit) {
    var count = {};
    rackLetters.forEach(function (ch) { count[ch] = (count[ch] || 0) + 1; });
    var res = [];
    dictWords.forEach(function (w) {
      var need = {}, ok = true;
      for (var i = 0; i < w.length; i++) {
        var ch = w.charAt(i);
        need[ch] = (need[ch] || 0) + 1;
        if (need[ch] > (count[ch] || 0)) { ok = false; break; }
      }
      if (ok) res.push(w);
    });
    res.sort(function (a, b) { return b.length - a.length || a.localeCompare(b); });
    return res.slice(0, limit || 5);
  }

  // ============ 轻松模式（小学生友好） ============

  // 发牌：给足冗余。按目标词数取更多词的字母打乱，
  // 保证至少能拼出目标词数个词，且一定有余牌。
  function dealCasual(targetWords, words, rng, dictArg) {
    rng = rng || Math.random;
    var dict = dictArg || new Set(words);
    var pool = shuffle(words, rng);
    // 字母预算：目标词数 × 7 张，保证可解且有余牌，又不至于字母架过长
    var budget = targetWords * 7;
    var chosen = [], tiles = [];
    for (var i = 0; i < pool.length && tiles.length < budget; i++) {
      var w = pool[i];
      if (!dict.has(w)) continue;
      // 接近预算时跳过过长的词，避免大幅超出
      if (tiles.length > 0 && tiles.length + w.length > budget + 2) continue;
      chosen.push(w);
      for (var k = 0; k < w.length; k++) tiles.push(w.charAt(k));
    }
    return { tiles: shuffle(tiles, rng), sourceWords: chosen };
  }

  // 宽松校验：任意摆放、无需交叉、无需用完；
  // 词库外的串只标黄提示（不算错、不阻断）；命中词库即时计分。
  function validateCasual(grid, acceptDict, targetWords) {
    var runs = extractWords(grid);
    var valid = [], unknown = [], score = 0, cells = {};
    var placedCount = 0;
    for (var r = 0; r < grid.length; r++) {
      for (var c = 0; c < grid.length; c++) if (grid[r][c]) placedCount++;
    }
    runs.forEach(function (run) {
      if (run.word.length < 3) return; // 2 字母串视为"还在拼"，不判定
      if (acceptDict.has(run.word)) {
        valid.push(run.word);
        score += wordPoints(run.word) + (run.word.length - 3) * 2; // 长词奖励
        run.cells.forEach(function (x) { cells[x.r + ',' + x.c] = 'ok'; });
      } else {
        unknown.push(run.word);
        run.cells.forEach(function (x) { if (!cells[x.r + ',' + x.c]) cells[x.r + ',' + x.c] = 'unknown'; });
      }
    });
    var target = targetWords || 1;
    return {
      ok: valid.length >= target,
      validWords: valid,
      unknownWords: unknown,
      score: score,
      cells: cells,
      placedCount: placedCount,
      target: target
    };
  }

  // 自动摆一个可拼的词（辅助功能）：返回可放置的 {word, r, c, dir} 或 null
  function suggestPlacement(rackLetters, acceptWords, dictArg) {
    var count = {};
    rackLetters.forEach(function (ch) { count[ch] = (count[ch] || 0) + 1; });
    var dict = dictArg || new Set(acceptWords);
    var candidates = acceptWords.filter(function (w) {
      if (w.length < 3) return false;
      var need = {};
      for (var i = 0; i < w.length; i++) {
        var ch = w.charAt(i);
        need[ch] = (need[ch] || 0) + 1;
        if (need[ch] > (count[ch] || 0)) return false;
      }
      return dict.has(w);
    });
    if (!candidates.length) return null;
    // 小学生友好：优先短词（3-5 字母），更容易摆下、更容易达成目标
    candidates.sort(function (a, b) { return a.length - b.length || a.localeCompare(b); });
    return { word: candidates[0] };
  }

  var api = {
    LETTER_POINTS: LETTER_POINTS,
    shuffle: shuffle,
    deal: deal,
    dealCasual: dealCasual,
    extractWords: extractWords,
    emptyGrid: emptyGrid,
    wordPoints: wordPoints,
    isConnected: isConnected,
    validate: validate,
    validateCasual: validateCasual,
    hints: hints,
    suggestPlacement: suggestPlacement
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GameCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
