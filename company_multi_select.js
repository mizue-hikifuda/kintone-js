(function() {
  'use strict';

  // マスタアプリの ID とフィールドコード
  const MASTER_APP_ID = 9;
  const MASTER_COMPANY_FIELD = 'companyName';
  const MASTER_BPOID_FIELD = 'bpoId';

  // このアプリ側のフィールドコード
  const SPACE_FIELD_CODE = 'company_multi_space'; // スペースフィールド
  const STORE_FIELD_CODE = 'company_multi_store'; // 選択結果を保存する文字列(複数行)フィールド

  // 対象イベント：新規作成画面・編集画面表示
  const showEvents = [
    'app.record.create.show',
    'app.record.edit.show'
  ];

  // 画面表示時：マスタから companyName を取得して複数選択 UI を描画
  kintone.events.on(showEvents, function(event) {
    var record = event.record;

    var spaceEl = kintone.app.record.getSpaceElement(SPACE_FIELD_CODE);
    if (!spaceEl) {
      console.warn('スペースフィールド（' + SPACE_FIELD_CODE + '）が見つかりません。');
      return event;
    }

    // 既に保存されている値を取得（カンマ区切り想定）
    var already = record[STORE_FIELD_CODE] && record[STORE_FIELD_CODE].value
      ? record[STORE_FIELD_CODE].value.split(',').map(function(v) { return v.trim(); }).filter(function(v) { return v; })
      : [];

    return fetchCompanies().then(function(companyList) {
      renderMultiSelect(spaceEl, companyList, already);
      return event;
    }).catch(function(err) {
      console.error('会社マスタ取得に失敗しました', err);
      return event;
    });
  });

  /**
   * マスタアプリ（ID=9）から companyName を取得
   * 条件：bpoId が空ではない
   */
  function fetchCompanies() {
    // const query = 'order by ' + MASTER_COMPANY_FIELD + ' asc';
    const query = MASTER_BPOID_FIELD + ' != "" order by ' + MASTER_COMPANY_FIELD + ' asc';
    const params = {
      app: MASTER_APP_ID,
      query: query,
      fields: [MASTER_COMPANY_FIELD, MASTER_BPOID_FIELD]
    };

    return kintone.api(
      kintone.api.url('/k/v1/records', true),
      'GET',
      params
    ).then(function(resp) {
      // companyName の配列を返す
      return resp.records.map(function(rec) {
        return rec[MASTER_COMPANY_FIELD].value;
      });
    });
  }

  /**
   * スペースフィールドに <select multiple> を描画
   * @param {HTMLElement} spaceEl スペースフィールドの要素
   * @param {Array<string>} companies companyName の配列
   * @param {Array<string>} selected 選択済み companyName の配列
   */
  function renderMultiSelect(spaceEl, companies, selected) {
    // 既に描画済みなら一旦クリア
    while (spaceEl.firstChild) {
      spaceEl.removeChild(spaceEl.firstChild);
    }

    // ラベル
    var label = document.createElement('div');
    label.textContent = '送り先を選んでください(複数選択はCtrlを押しながら)';
    spaceEl.appendChild(label);

    // <select multiple>
    var select = document.createElement('select');
    select.id = 'company-multi-select';
    select.multiple = true;
    select.style.width = '300px';
    select.style.height = '200px';

    companies.forEach(function(name) {
      var option = document.createElement('option');
      option.value = name;
      option.textContent = name;

      // 既存レコードで選択済みのものは pre-select
      if (selected && selected.indexOf(name) !== -1) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    spaceEl.appendChild(select);
  }

  /**
   * <select multiple> から選択された値を配列で取得
   */
  function getSelectedCompanies() {
    var select = document.getElementById('company-multi-select');
    if (!select) {
      return [];
    }
    var values = [];
    for (var i = 0; i < select.options.length; i++) {
      var opt = select.options[i];
      if (opt.selected) {
        values.push(opt.value);
      }
    }
    return values;
  }

  // 保存前（新規・編集）に、選択結果を文字列フィールドに反映
  var submitEvents = [
    'app.record.create.submit',
    'app.record.edit.submit'
  ];

  kintone.events.on(submitEvents, function(event) {
    var record = event.record;

    var selected = getSelectedCompanies(); // 配列
    // カンマ区切りの文字列にして保存（お好みで JSON.stringify(selected) などでも可）
    record[STORE_FIELD_CODE].value = selected.join('\n');
    // record[STORE_FIELD_CODE].value = selected.join(', ');

    return event;
  });

})();
