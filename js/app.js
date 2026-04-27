const API_BASE = 'https://linkwork-backlink-api.dyjae93.workers.dev';

let currentTab = 'sites';
let sites = [];
let submissions = [];
let keywordBatches = [];
let keywordRecords = [];
let keywordLoadTimer;
let keywordSort = {
  field: '',
  direction: '',
};

const siteTypeLabels = {
  blog: '博客',
  forum: '论坛',
  directory: '目录',
  news: '新闻',
  tool: '工具',
  social: '社交',
  other: '其他'
};

const backlinkTypeLabels = {
  comment: '评论',
  site_submission: '网站提交',
  profile_post: '个人资料',
  forum_thread: '论坛主题',
  article_submission: '文章提交',
  contact_outreach: '联系外展',
  other: '其他'
};

const statusLabels = {
  pending: '待处理',
  sent: '已发送',
  failed: '失败'
};

async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || '请求失败');
    }

    return data;
  } catch (error) {
    showToast(error.message, 'error');
    throw error;
  }
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');

  toastMessage.textContent = message;
  toast.className = `fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg text-white ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

function switchTab(tab) {
  currentTab = tab;

  document.getElementById('tab-sites').classList.toggle('hidden', tab !== 'sites');
  document.getElementById('tab-submissions').classList.toggle('hidden', tab !== 'submissions');
  document.getElementById('tab-keywords').classList.toggle('hidden', tab !== 'keywords');

  document.getElementById('nav-sites').classList.toggle('active', tab === 'sites');
  document.getElementById('nav-submissions').classList.toggle('active', tab === 'submissions');
  document.getElementById('nav-keywords').classList.toggle('active', tab === 'keywords');

  if (tab === 'sites') {
    loadSites();
  } else if (tab === 'submissions') {
    loadSubmissions();
  } else {
    loadKeywordData();
  }
}

// Sites CRUD
async function loadSites() {
  const siteType = document.getElementById('filter-site-type').value;
  const backlinkType = document.getElementById('filter-backlink-type').value;

  let endpoint = '/api/backlink-sites?';
  const params = [];
  if (siteType) params.push(`site_type=${siteType}`);
  if (backlinkType) params.push(`backlink_type=${backlinkType}`);
  endpoint += params.join('&');

  try {
    const data = await apiRequest(endpoint);
    sites = data.data || [];
    renderSites();
  } catch (error) {
    console.error('Failed to load sites:', error);
  }
}

function renderSites() {
  const tbody = document.getElementById('sites-tbody');

  if (sites.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">暂无数据</td></tr>`;
    return;
  }

  tbody.innerHTML = sites.map(site => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3">
        <a href="${escapeHtml(site.url)}" target="_blank" class="table-link">${escapeHtml(site.url)}</a>
      </td>
      <td class="px-4 py-3 text-sm text-gray-900">${siteTypeLabels[site.site_type] || site.site_type}</td>
      <td class="px-4 py-3 text-sm text-gray-900">${site.dr}</td>
      <td class="px-4 py-3 text-sm text-gray-900">${backlinkTypeLabels[site.backlink_type] || site.backlink_type}</td>
      <td class="px-4 py-3 text-sm text-gray-900">${site.requires_login ? '是' : '否'}</td>
      <td class="px-4 py-3 text-sm">
        <button onclick="editSite(${site.id})" class="text-blue-600 hover:text-blue-800 mr-3">编辑</button>
        <button onclick="deleteSite(${site.id})" class="text-red-600 hover:text-red-800">删除</button>
      </td>
    </tr>
  `).join('');
}

function openSiteModal(site = null) {
  const modal = document.getElementById('site-modal');
  const title = document.getElementById('site-modal-title');
  const form = document.getElementById('site-form');

  form.reset();
  document.getElementById('site-id').value = '';

  if (site) {
    title.textContent = '编辑网站';
    document.getElementById('site-id').value = site.id;
    document.getElementById('site-url').value = site.url;
    document.getElementById('site-type').value = site.site_type;
    document.getElementById('site-dr').value = site.dr;
    document.getElementById('site-backlink-type').value = site.backlink_type;
    document.getElementById('site-requires-login').checked = !!site.requires_login;
  } else {
    title.textContent = '新增网站';
  }

  modal.classList.remove('hidden');
}

function closeSiteModal() {
  document.getElementById('site-modal').classList.add('hidden');
}

function editSite(id) {
  const site = sites.find(s => s.id === id);
  if (site) {
    openSiteModal(site);
  }
}

async function saveSite(event) {
  event.preventDefault();

  const id = document.getElementById('site-id').value;
  const data = {
    url: document.getElementById('site-url').value,
    site_type: document.getElementById('site-type').value,
    dr: parseInt(document.getElementById('site-dr').value),
    backlink_type: document.getElementById('site-backlink-type').value,
    requires_login: document.getElementById('site-requires-login').checked,
  };

  try {
    if (id) {
      await apiRequest(`/api/backlink-sites/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      showToast('网站更新成功');
    } else {
      await apiRequest('/api/backlink-sites', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      showToast('网站创建成功');
    }
    closeSiteModal();
    loadSites();
  } catch (error) {
    console.error('Failed to save site:', error);
  }
}

async function deleteSite(id) {
  if (!confirm('确定要删除这个网站吗？相关的发帖记录也会被删除。')) {
    return;
  }

  try {
    await apiRequest(`/api/backlink-sites/${id}`, {
      method: 'DELETE',
    });
    showToast('网站删除成功');
    loadSites();
  } catch (error) {
    console.error('Failed to delete site:', error);
  }
}

let debounceTimer;
function debounceLoadSubmissions() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadSubmissions, 300);
}

function debounceLoadKeywordData() {
  clearTimeout(keywordLoadTimer);
  keywordLoadTimer = setTimeout(loadKeywordData, 300);
}

// Submissions CRUD
async function loadSubmissions() {
  const status = document.getElementById('filter-submission-status').value;
  const siteId = document.getElementById('filter-submission-site').value;
  const mySiteFilter = document.getElementById('filter-my-site').value.toLowerCase();

  let endpoint = '/api/backlink-submissions?';
  const params = [];
  if (status) params.push(`status=${status}`);
  if (siteId) params.push(`backlink_site_id=${siteId}`);
  endpoint += params.join('&');

  try {
    const [submissionsData, sitesData] = await Promise.all([
      apiRequest(endpoint),
      loadSitesForSelect()
    ]);

    submissions = (submissionsData.data || []).filter(sub =>
      !mySiteFilter || sub.my_site_url.toLowerCase().includes(mySiteFilter)
    );
    renderSubmissions();
  } catch (error) {
    console.error('Failed to load submissions:', error);
  }
}

async function loadSitesForSelect() {
  try {
    const data = await apiRequest('/api/backlink-sites');
    sites = data.data || [];

    const selects = [
      document.getElementById('filter-submission-site'),
      document.getElementById('submission-site-id')
    ];

    const currentFilter = selects[0].value;

    selects.forEach(select => {
      const currentValue = select.id === 'filter-submission-site'
        ? currentFilter
        : select.id === 'submission-site-id' ? select.value : '';

      const placeholder = select.id === 'filter-submission-site' ? '全部网站' : '选择网站';

      select.innerHTML = `<option value="">${placeholder}</option>` +
        sites.map(s => `<option value="${s.id}">${escapeHtml(s.url)}</option>`).join('');

      if (currentValue) {
        select.value = currentValue;
      }
    });

    return sites;
  } catch (error) {
    console.error('Failed to load sites for select:', error);
    return [];
  }
}

function renderSubmissions() {
  const tbody = document.getElementById('submissions-tbody');

  if (submissions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">暂无数据</td></tr>`;
    return;
  }

  tbody.innerHTML = submissions.map(sub => {
    const site = sites.find(s => s.id === sub.backlink_site_id);
    const siteUrl = site ? escapeHtml(site.url) : '未知';

    return `
      <tr class="hover:bg-gray-50">
        <td class="px-4 py-3 text-sm">
          <a href="${escapeHtml(sub.my_site_url)}" target="_blank" class="table-link">${escapeHtml(sub.my_site_url)}</a>
        </td>
        <td class="px-4 py-3 text-sm text-gray-900">${siteUrl}</td>
        <td class="px-4 py-3 text-sm text-gray-900">${sub.target_url ? `<a href="${escapeHtml(sub.target_url)}" target="_blank" class="table-link">链接</a>` : '-'}</td>
        <td class="px-4 py-3">
          <select class="status-select ${sub.status === 'pending' ? 'border-yellow-400' : sub.status === 'sent' ? 'border-green-400' : 'border-red-400'}"
                  onchange="updateSubmissionStatus(${sub.id}, this.value)">
            <option value="pending" ${sub.status === 'pending' ? 'selected' : ''}>待处理</option>
            <option value="sent" ${sub.status === 'sent' ? 'selected' : ''}>已发送</option>
            <option value="failed" ${sub.status === 'failed' ? 'selected' : ''}>失败</option>
          </select>
        </td>
        <td class="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">${escapeHtml(sub.note || '-')}</td>
        <td class="px-4 py-3 text-sm">
          <button onclick="editSubmission(${sub.id})" class="text-blue-600 hover:text-blue-800 mr-3">编辑</button>
          <button onclick="deleteSubmission(${sub.id})" class="text-red-600 hover:text-red-800">删除</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openSubmissionModal(submission = null) {
  const modal = document.getElementById('submission-modal');
  const title = document.getElementById('submission-modal-title');
  const form = document.getElementById('submission-form');

  form.reset();

  loadSitesForSelect().then(() => {
    if (submission) {
      title.textContent = '编辑记录';
      document.getElementById('submission-id').value = submission.id;
      document.getElementById('submission-my-site-url').value = submission.my_site_url;
      document.getElementById('submission-site-id').value = submission.backlink_site_id;
      document.getElementById('submission-status').value = submission.status;
      document.getElementById('submission-target-url').value = submission.target_url || '';
      document.getElementById('submission-note').value = submission.note || '';
    } else {
      title.textContent = '新增记录';
    }
    document.getElementById('submission-id').value = submission?.id || '';
  });

  modal.classList.remove('hidden');
}

function closeSubmissionModal() {
  document.getElementById('submission-modal').classList.add('hidden');
}

function editSubmission(id) {
  const submission = submissions.find(s => s.id === id);
  if (submission) {
    openSubmissionModal(submission);
  }
}

async function saveSubmission(event) {
  event.preventDefault();

  const id = document.getElementById('submission-id').value;
  const data = {
    my_site_url: document.getElementById('submission-my-site-url').value,
    backlink_site_id: parseInt(document.getElementById('submission-site-id').value),
    status: document.getElementById('submission-status').value,
    target_url: document.getElementById('submission-target-url').value || undefined,
    note: document.getElementById('submission-note').value || undefined,
  };

  try {
    if (id) {
      await apiRequest(`/api/backlink-submissions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      showToast('记录更新成功');
    } else {
      await apiRequest('/api/backlink-submissions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      showToast('记录创建成功');
    }
    closeSubmissionModal();
    loadSubmissions();
  } catch (error) {
    console.error('Failed to save submission:', error);
  }
}

async function updateSubmissionStatus(id, status) {
  try {
    await apiRequest(`/api/backlink-submissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    showToast('状态更新成功');
  } catch (error) {
    console.error('Failed to update status:', error);
    loadSubmissions();
  }
}

async function deleteSubmission(id) {
  if (!confirm('确定要删除这条记录吗？')) {
    return;
  }

  try {
    await apiRequest(`/api/backlink-submissions/${id}`, {
      method: 'DELETE',
    });
    showToast('记录删除成功');
    loadSubmissions();
  } catch (error) {
    console.error('Failed to delete submission:', error);
  }
}

async function loadKeywordData() {
  const domain = document.getElementById('filter-keyword-domain').value.trim();

  const params = new URLSearchParams();
  if (domain) params.set('domain', domain);

  const endpoint = `/api/website-keyword-batches${params.toString() ? `?${params.toString()}` : ''}`;

  try {
    const data = await apiRequest(endpoint);
    keywordBatches = data.data || [];

    if (keywordBatches.length === 0) {
      keywordRecords = [];
      renderKeywordRecords();
      return;
    }

    const detailResponses = await Promise.all(
      keywordBatches.map(batch => apiRequest(`/api/website-keyword-batches/${batch.id}`))
    );

    keywordRecords = detailResponses.flatMap(response => {
      const batch = response.data || {};
      return (batch.records || []).map(record => ({
        ...record,
        batch_domain: batch.domain || '',
        batch_source: batch.source || '',
        batch_web_source: batch.web_source || '',
        batch_period_start: batch.period_start || '',
        batch_period_end: batch.period_end || '',
      }));
    });

    renderKeywordRecords();
  } catch (error) {
    console.error('Failed to load keyword batches:', error);
  }
}

function toggleKeywordSort(field) {
  if (keywordSort.field !== field) {
    keywordSort = { field, direction: 'desc' };
  } else if (keywordSort.direction === 'desc') {
    keywordSort = { field, direction: 'asc' };
  } else if (keywordSort.direction === 'asc') {
    keywordSort = { field: '', direction: '' };
  } else {
    keywordSort = { field, direction: 'desc' };
  }

  renderKeywordRecords();
}

function updateKeywordSortIndicators() {
  const fields = ['rank_position', 'clicks', 'kw_volume'];

  fields.forEach(field => {
    const indicator = document.getElementById(`sort-${field}-indicator`);
    if (!indicator) return;

    if (keywordSort.field !== field || !keywordSort.direction) {
      indicator.textContent = '-';
      indicator.className = 'text-[10px] text-gray-400';
      return;
    }

    indicator.textContent = keywordSort.direction === 'desc' ? '↓' : '↑';
    indicator.className = 'text-[10px] text-blue-600';
  });
}

function renderKeywordRecords() {
  const tbody = document.getElementById('keyword-records-tbody');
  const filter = document.getElementById('filter-keyword-record').value.trim().toLowerCase();

  const filtered = keywordRecords
    .filter(record => {
      if (!filter) return true;
      return (
        (record.keyword || '').toLowerCase().includes(filter) ||
        (record.top_url || '').toLowerCase().includes(filter) ||
        (record.batch_domain || '').toLowerCase().includes(filter)
      );
    })
    .sort((a, b) => compareKeywordRecords(a, b))
    .slice(0, 100);

  updateKeywordSortIndicators();

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-gray-500">暂无数据</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(record => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 text-sm text-gray-900">
        <div class="font-medium">${escapeHtml(record.batch_domain || '-')}</div>
        <div class="mt-1 text-xs text-gray-500">${escapeHtml(record.batch_period_start || '-')} ~ ${escapeHtml(record.batch_period_end || '-')}</div>
      </td>
      <td class="px-4 py-3 text-sm text-gray-900">
        <div class="font-medium">${escapeHtml(record.keyword)}</div>
        <div class="mt-1 text-xs text-gray-500">${formatSerpFeatures(record.serp_features)}</div>
      </td>
      <td class="px-4 py-3 text-sm font-medium text-gray-900">${record.rank_position ?? '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-900">${formatNumber(record.clicks)}</td>
      <td class="px-4 py-3 text-sm text-gray-900">${formatNumber(record.kw_volume)}</td>
      <td class="px-4 py-3 text-sm text-gray-900">${escapeHtml(record.primary_intent || '-')}</td>
      <td class="px-4 py-3 text-sm text-gray-900">
        ${record.top_url ? `<a href="${escapeHtml(record.top_url)}" target="_blank" class="table-link keyword-url">${escapeHtml(record.top_url)}</a>` : '-'}
      </td>
    </tr>
  `).join('');
}

function compareKeywordRecords(a, b) {
  if (!keywordSort.field || !keywordSort.direction) {
    return 0;
  }

  const aValue = normalizeKeywordSortValue(a[keywordSort.field]);
  const bValue = normalizeKeywordSortValue(b[keywordSort.field]);

  if (aValue === bValue) {
    return 0;
  }

  return keywordSort.direction === 'desc' ? bValue - aValue : aValue - bValue;
}

function normalizeKeywordSortValue(value) {
  if (value === null || value === undefined || value === '') {
    return Number.NEGATIVE_INFINITY;
  }

  const number = Number(value);
  return Number.isNaN(number) ? Number.NEGATIVE_INFINITY : number;
}

function formatSerpFeatures(features = []) {
  if (!Array.isArray(features) || features.length === 0) {
    return '无 SERP 特征';
  }
  return features.join(' · ');
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  const number = Number(value);
  if (Number.isNaN(number)) {
    return String(value);
  }
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(number);
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSites();
  loadSitesForSelect();
  renderKeywordRecords();
});
