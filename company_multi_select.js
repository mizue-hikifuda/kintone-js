(function() {
  'use strict';

  // マスタアプリの ID とフィールドコード
  const MASTER_APP_ID = 9;
  const MASTER_COMPANY_FIELD = 'companyName';
  const MASTER_BPOID_FIELD = 'bpoId';
  const MASTER_GOOGLE_DRIVE_ID_FIELD = 'google_drive_id';

  // このアプリ側のフィールドコード
  const SPACE_FIELD_CODE = 'company_multi_space'; // スペースフィールド
  const STORE_FIELD_CODE = 'company_multi_store'; // 選択結果を保存する文字列(複数行)フィールド
  const SLACKID_FIELD_CODE = 'slackId_multi';     // 新しいフィールド：bpoId を保存する文字列(複数行)フィールド
  const GOOGLE_DRIVE_ID_MULTI_FIELD_CODE = 'google_drive_id_multi';

  // 対象イベント：新規作成画面・編集画面表示
  const showEvents = [
    'app.record.create.show',
    'app.record.edit.show'
  ];

  // 画面表示時：マスタから companyName, bpoId を取得して複数選択 UI を描画
  kintone.events.on(showEvents, function(event) {
    var record = event.record;

    var spaceEl = kintone.app.record.getSpaceElement(SPACE_FIELD_CODE);
    if (!spaceEl) {
      console.warn('スペースフィールド（' + SPACE_FIELD_CODE + '）が見つかりません。');
      return event;
    }

    // 既に保存されている値を取得（改行区切り想定）
    var already = record[STORE_FIELD_CODE] && record[STORE_FIELD_CODE].value
      ? record[STORE_FIELD_CODE].value.split('\n').map(function(v) { return v.trim(); }).filter(function(v) { return v; })
      : [];

    return fetchCompanies().then(function(companyList) {
      // companyList: [{ name: '...', bpoId: '...' }, ...]
      renderMultiSelect(spaceEl, companyList, already);
      return event;
    }).catch(function(err) {
      console.error('会社マスタ取得に失敗しました', err);
      return event;
    });
  });

  /**
   * マスタアプリ（ID=9）から companyName, bpoId を取得
   * 条件：bpoId が空ではない
   * @return {Promise<Array<{name: string, bpoId: string}>>}
   */
  function fetchCompanies() {
    const query = MASTER_BPOID_FIELD + ' != "" order by ' + MASTER_COMPANY_FIELD + ' asc';
    const params = {
      app: MASTER_APP_ID,
      query: query,
      fields: [MASTER_COMPANY_FIELD, MASTER_BPOID_FIELD, MASTER_GOOGLE_DRIVE_ID_FIELD]
    };

    return kintone.api(
      kintone.api.url('/k/v1/records', true),
      'GET',
      params
    ).then(function(resp) {
      // companyName, bpoId のペア配列を返す
      return resp.records.map(function(rec) {
        return {
          name: rec[MASTER_COMPANY_FIELD].value,
          bpoId: rec[MASTER_BPOID_FIELD].value,
          googleDriveId: rec[MASTER_GOOGLE_DRIVE_ID_FIELD].value
        };
      });
    });
  }

  /**
   * スペースフィールドに <select multiple> を描画
   * @param {HTMLElement} spaceEl スペースフィールドの要素
   * @param {Array<{name: string, bpoId: string}>} companies companyName, bpoId の配列
   * @param {Array<string>} selected 選択済み companyName の配列
   */
  function renderMultiSelect(spaceEl, companies, selected) {
    // 既に描画済みなら一旦クリア
    while (spaceEl.firstChild) {
      spaceEl.removeChild(spaceEl.firstChild);
    }

    // ラベル
    var label = document.createElement('div');
    label.textContent = '送り先を選択してください(Ctrlを押しながら複数選択)';
    spaceEl.appendChild(label);

    // <select multiple>
    var select = document.createElement('select');
    select.id = 'company-multi-select';
    select.multiple = true;
    select.style.width = '300px';
    select.style.height = '200px';

    companies.forEach(function(item) {
      var option = document.createElement('option');
      option.value = item.name;                 // 表示＆選択値は companyName
      option.textContent = item.name;
      option.setAttribute('data-bpoid', item.bpoId); // bpoId を属性に保持
      option.setAttribute('data-googledriveid', item.googleDriveId); // googleDriveId を属性に保持

      // 既存レコードで選択済みのものは pre-select
      if (selected && selected.indexOf(item.name) !== -1) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    spaceEl.appendChild(select);
  }

  /**
   * <select multiple> から選択されたデータを配列で取得
   * @return {Array<{name: string, bpoId: string, googleDriveId: string}>}
   */
  function getSelectedCompanyInfos() {
    var select = document.getElementById('company-multi-select');
    if (!select) {
      return [];
    }
    var list = [];
    for (var i = 0; i < select.options.length; i++) {
      var opt = select.options[i];
      if (opt.selected) {
        list.push({
          name: opt.value,
          bpoId: opt.getAttribute('data-bpoid') || '',
          googleDriveId: opt.getAttribute('data-googledriveid') || ''
        });
      }
    }
    return list;
  }

  // 保存前（新規・編集）に、選択結果を文字列フィールドに反映
  var submitEvents = [
    'app.record.create.submit',
    'app.record.edit.submit'
  ];

  kintone.events.on(submitEvents, function(event) {
    var record = event.record;

    var selectedInfos = getSelectedCompanyInfos(); // [{name, bpoId, googleDriveId}, ...]
    var selectedNames = selectedInfos.map(function(item) { return item.name; });
    var selectedBpoIds = selectedInfos.map(function(item) { return item.bpoId; });
    var selectedGoogleDriveIds = selectedInfos.map(function(item) { return item.googleDriveId; });

    // company_multi_store には companyName 
    record[STORE_FIELD_CODE].value = selectedNames.join('\n');

    // slackId_multi には bpoId 
    if (record[SLACKID_FIELD_CODE]) {
      record[SLACKID_FIELD_CODE].value = selectedBpoIds.join(',');
    }

    // google_drive_id_multi には google_drive_id
    if (record[GOOGLE_DRIVE_ID_MULTI_FIELD_CODE]) {
      record[GOOGLE_DRIVE_ID_MULTI_FIELD_CODE].value = selectedGoogleDriveIds.join(',');
    }

    return event;
  });

})();
