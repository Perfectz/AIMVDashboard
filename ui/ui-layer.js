(function () {
  const WORKFLOW_ITEMS = [
    { key: 'home', icon: '00', label: 'Project Home', href: 'home.html' },
    { key: 'step1', icon: '01', label: 'Step 1: Theme', href: 'step1.html' },
    { key: 'step2', icon: '02', label: 'Step 2: Music', href: 'step2.html' },
    { key: 'step3', icon: '03', label: 'Step 3: Canon', href: 'step3.html' },
    { key: 'step4', icon: '04', label: 'Step 4: References', href: 'step4.html' },
    { key: 'index', icon: '05', label: 'Step 5: Shots', href: 'index.html' },
    { key: 'storyboard', icon: '06', label: 'Step 6: Storyboard Preview', href: 'storyboard.html' }
  ];
  const BRAND_CONFIG = {
    standard: { title: 'Prompt Compiler', subtitle: 'AI Music Video Project' },
    storyboard: { title: 'Storyboard Preview', subtitle: 'Ordered timeline for selected shots and references' },
    basic: { title: 'Prompt Compiler', subtitle: 'AI Music Video Project' },
    guide: { title: 'User Guide', subtitle: 'Complete workflow documentation' }
  };
  const NAV_VERSION = 'v2026-02-10';

  function getProjectContextApi() {
    return window.ProjectContext || null;
  }

  function normalizeProjectId(value) {
    const api = getProjectContextApi();
    if (api && typeof api.normalizeProjectId === 'function') {
      return api.normalizeProjectId(value);
    }
    const id = String(value || '').trim();
    return id || '';
  }

  function persistProjectFromQuery() {
    const api = getProjectContextApi();
    if (api && typeof api.persistProjectFromQuery === 'function') {
      api.persistProjectFromQuery();
    }
  }

  function getCurrentProjectId(root) {
    const api = getProjectContextApi();
    if (api && typeof api.getCurrentProjectId === 'function') {
      return api.getCurrentProjectId('projectSelector', root || document);
    }

    const scope = root || document;
    const selector = scope.querySelector('#projectSelector');
    if (selector && selector.value) {
      return normalizeProjectId(selector.value);
    }
    return '';
  }

  function withProjectParam(href, projectId) {
    const api = getProjectContextApi();
    if (api && typeof api.buildProjectUrl === 'function') {
      return api.buildProjectUrl(href, projectId);
    }
    return String(href || '').trim();
  }

  function createElement(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = text;
    return el;
  }

  function renderNavBrand(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-ui-nav-brand]').forEach((container) => {
      const mode = container.getAttribute('data-ui-mode') || 'standard';
      const config = BRAND_CONFIG[mode] || BRAND_CONFIG.standard;
      container.innerHTML = '';
      container.appendChild(createElement('h1', '', config.title));
      container.appendChild(createElement('p', 'nav-subtitle', config.subtitle));
    });
  }

  function renderProjectSelectorSection(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-ui-project-selector]').forEach((container) => {
      const mode = container.getAttribute('data-ui-mode') || 'standard';
      const includeProjectActions = mode !== 'basic';
      container.innerHTML = '';

      const header = createElement('div', 'nav-header');
      header.appendChild(createElement('div', 'nav-title', 'Current Project'));
      if (includeProjectActions) {
        const actions = createElement('div', 'project-selector-actions');
        const add = createElement('button', 'btn-icon', '+');
        add.id = 'newProjectBtn';
        add.type = 'button';
        add.title = 'New Project';
        actions.appendChild(add);

        const remove = createElement('button', 'btn-icon btn-icon-danger', '-');
        remove.id = 'deleteProjectBtn';
        remove.type = 'button';
        remove.title = 'Delete Project';
        actions.appendChild(remove);

        header.appendChild(actions);
      }

      const select = createElement('select', 'project-dropdown');
      select.id = 'projectSelector';
      const option = createElement('option', '', 'Loading...');
      option.value = 'default';
      select.appendChild(option);

      container.appendChild(header);
      container.appendChild(select);
    });
  }

  function createStatItem(valueId, label, extraClass = '') {
    const item = createElement('div', `nav-stat-item ${extraClass}`.trim());
    const value = createElement('div', 'nav-stat-value', '0');
    value.id = valueId;
    const labelEl = createElement('div', 'nav-stat-label', label);
    item.appendChild(value);
    item.appendChild(labelEl);
    return item;
  }

  function renderNavStats(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-ui-nav-stats]').forEach((container) => {
      container.innerHTML = '';
      container.appendChild(createStatItem('stat-shots', 'Total Shots'));
      container.appendChild(createStatItem('stat-ready', 'Ready'));
      container.appendChild(createStatItem('stat-passed', 'Validated', 'nav-stat-success'));
      container.appendChild(createStatItem('stat-failed', 'Errors', 'nav-stat-error'));
    });
  }

  function renderNavFooter(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-ui-nav-footer]').forEach((container) => {
      container.innerHTML = '';
      const version = createElement('div', 'nav-version', NAV_VERSION);
      container.appendChild(version);
    });
  }

  function createStatTile(config) {
    const tile = createElement('div', `ui-stat-tile ${config.tone ? `ui-tone-${config.tone}` : ''}`.trim());
    if (config.id) tile.id = config.id;

    tile.appendChild(createElement('div', 'ui-stat-label', config.label || 'Metric'));
    tile.appendChild(createElement('div', 'ui-stat-value', config.value || '0'));

    if (config.meta) {
      tile.appendChild(createElement('div', 'ui-stat-meta', config.meta));
    }
    return tile;
  }

  function renderStatGrid(container, items) {
    if (!container) return;
    container.innerHTML = '';
    items.forEach((item) => container.appendChild(createStatTile(item)));
  }

  function createListItem(item) {
    const row = createElement('div', 'ui-list-item');
    const left = createElement('span');
    if (item.code) {
      const code = createElement('code', '', item.code);
      left.appendChild(code);
      left.appendChild(document.createTextNode(item.text ? `: ${item.text}` : ''));
    } else {
      left.textContent = item.text || '';
    }

    row.appendChild(left);

    if (item.href) {
      const link = createElement('a', '', item.linkText || 'Open');
      link.href = item.href;
      const icon = createElement('sl-icon');
      icon.name = 'arrow-up-right';
      icon.style.marginLeft = '0.3rem';
      icon.style.fontSize = '0.8rem';
      link.appendChild(icon);
      row.appendChild(link);
    }

    return row;
  }

  function renderList(container, items, emptyItem) {
    if (!container) return;
    container.innerHTML = '';

    const safeItems = Array.isArray(items) ? items : [];
    if (safeItems.length === 0 && emptyItem) {
      container.appendChild(createListItem(emptyItem));
      return;
    }

    safeItems.forEach((item) => container.appendChild(createListItem(item)));
  }

  function createShotSidebarItem(config) {
    const shotItem = createElement('div', 'shot-item');
    if (config.active) shotItem.classList.add('active');
    if (config.onClick) shotItem.addEventListener('click', config.onClick);

    const header = createElement('div', 'shot-item-header', config.shotId || 'SHOT');
    shotItem.appendChild(header);

    const tools = createElement('div', 'shot-item-tools');
    (config.tags || []).forEach((tagConfig) => {
      const tag = createElement('span', `tool-tag ${tagConfig.className || ''}`.trim(), tagConfig.text || '');
      tools.appendChild(tag);
    });
    shotItem.appendChild(tools);
    return shotItem;
  }

  function renderMetaItems(container, items, className = 'ui-meta-item') {
    if (!container) return;
    container.innerHTML = '';
    (items || []).filter((item) => item && item.value !== undefined && item.value !== null && item.value !== '').forEach((item) => {
      const row = createElement('div', className, item.label ? `${item.label}: ${item.value}` : String(item.value));
      container.appendChild(row);
    });
  }

  function wireDataNav(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-nav-url], [data-workspace-url]').forEach((el) => {
      if (el.dataset.uiNavBound === '1') return;
      el.dataset.uiNavBound = '1';
      el.addEventListener('click', () => {
        const baseUrl = el.getAttribute('data-nav-url') || el.getAttribute('data-workspace-url');
        if (baseUrl) {
          const url = withProjectParam(baseUrl, getCurrentProjectId(scope));
          window.location.href = url;
        }
      });
    });
  }

  function hydrateProjectLinks(root) {
    const scope = root || document;
    const projectId = getCurrentProjectId(scope);
    if (!projectId) return;

    scope.querySelectorAll('a[href]').forEach((link) => {
      if (link.dataset.uiProjectLinkBound === '1') return;
      link.dataset.uiProjectLinkBound = '1';
      const href = link.getAttribute('href') || '';
      const nextHref = withProjectParam(href, projectId);
      if (nextHref && nextHref !== href) {
        link.setAttribute('href', nextHref);
      }
    });
  }

  function createNavButton(item, current, options = {}) {
    const button = createElement('button', `nav-item ${item.key === current ? 'active' : ''}`.trim());
    button.type = 'button';
    if (options.useWorkspaceUrl && item.href) {
      button.setAttribute('data-workspace-url', item.href);
      button.setAttribute('data-workspace-title', item.label);
    } else if (item.href) {
      button.setAttribute('data-nav-url', item.href);
    }
    if (item.id) button.id = item.id;

    const icon = createElement('span', 'nav-icon', item.icon);
    const label = createElement('span', 'nav-label', item.label);
    button.appendChild(icon);
    button.appendChild(label);

    if (item.countId) {
      const count = createElement('span', 'nav-count', '0');
      count.id = item.countId;
      button.appendChild(count);
    }

    // Step completion badge placeholder
    if (item.key && item.key.startsWith('step') || item.key === 'index' || item.key === 'storyboard') {
      const badge = createElement('span', 'step-badge badge-empty');
      badge.dataset.stepKey = item.key;
      button.appendChild(badge);
    }

    return button;
  }

  /**
   * Update step completion badges.
   * @param {Object} statuses - e.g. { step1: 'complete', step2: 'partial', step3: 'empty' }
   */
  function updateStepBadges(statuses) {
    Object.keys(statuses || {}).forEach(function(key) {
      var badges = document.querySelectorAll('.step-badge[data-step-key="' + key + '"]');
      badges.forEach(function(badge) {
        badge.className = 'step-badge badge-' + (statuses[key] || 'empty');
      });
    });
  }

  function getWorkflowItems(mode) {
    const includeHome = mode === 'basic';
    return WORKFLOW_ITEMS.filter((item) => includeHome || item.key !== 'home').map((item) => ({ ...item }));
  }

  function renderWorkflowNavs(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-ui-workflow-nav]').forEach((container) => {
      const current = container.getAttribute('data-ui-current') || '';
      const mode = container.getAttribute('data-ui-mode') || 'standard';
      const items = getWorkflowItems(mode);
      const useWorkspaceUrl = mode === 'prompts';

      container.innerHTML = '';
      items.forEach((item) => {
        if (mode === 'prompts') {
          if (item.key === 'index') {
            item.id = 'promptsNavBtn';
            item.href = '';
          }
          if (item.key === 'storyboard') {
            item.id = 'openStoryboardNavBtn';
          }
        }
        if (item.key === 'index') {
          item.countId = 'nav-count-all';
        }
        const button = createNavButton(item, current, { useWorkspaceUrl });
        container.appendChild(button);
      });
    });
  }

  function renderResourceNavs(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-ui-resource-nav]').forEach((container) => {
      const current = container.getAttribute('data-ui-current') || '';
      const mode = container.getAttribute('data-ui-mode') || 'standard';
      const useWorkspaceUrl = mode === 'prompts';
      container.innerHTML = '';

      const guide = {
        key: 'guide',
        icon: '?',
        label: 'User Guide',
        href: 'guide.html',
        id: useWorkspaceUrl ? 'openGuideNavBtn' : ''
      };
      const button = createNavButton(guide, current, { useWorkspaceUrl });
      container.appendChild(button);
    });
  }

  function renderGuideNavs(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-ui-guide-nav]').forEach((container) => {
      const current = container.getAttribute('data-ui-current') || 'guide';
      const items = [
        { key: 'index', icon: '05', label: 'Prompts UI', href: 'index.html' },
        { key: 'storyboard', icon: '06', label: 'Storyboard', href: 'storyboard.html' },
        { key: 'guide', icon: '?', label: 'User Guide', href: 'guide.html' },
        { key: 'home', icon: '00', label: 'Project Home', href: 'home.html' }
      ];
      container.innerHTML = '';
      items.forEach((item) => {
        const button = createNavButton(item, current, { useWorkspaceUrl: false });
        container.appendChild(button);
      });
    });
  }

  async function hydrateGuideProjectSelector(root) {
    const scope = root || document;
    const isGuidePage = /\/guide\.html$/i.test(window.location.pathname) || /guide\.html/i.test(window.location.href);
    if (!isGuidePage) return;

    const selector = scope.querySelector('#projectSelector');
    if (!selector) return;

    try {
      const projectServiceFactory = window.ProjectService;
      if (!projectServiceFactory || !projectServiceFactory.createProjectService) return;

      const service = projectServiceFactory.createProjectService();
      const result = await service.listProjects();
      const data = result && result.data;
      if (!result || !result.ok || !data || !Array.isArray(data.projects) || data.projects.length === 0) return;

      let activeId = null;
      try { activeId = localStorage.getItem('activeProject'); } catch { activeId = null; }
      if (!activeId || !data.projects.some((p) => p.id === activeId)) {
        activeId = data.projects[0].id;
      }

      selector.innerHTML = '';
      data.projects.forEach((project) => {
        const option = createElement('option', '', project.name);
        option.value = project.id;
        selector.appendChild(option);
      });
      selector.value = activeId;
      selector.dataset.uiGuideBound = '1';

      if (!selector.dataset.uiGuideChangeBound) {
        selector.dataset.uiGuideChangeBound = '1';
        selector.addEventListener('change', (e) => {
          const nextProject = e.target.value;
          try { localStorage.setItem('activeProject', nextProject); } catch {}
          const url = new URL(window.location.href);
          url.searchParams.set('project', nextProject);
          window.location.href = url.toString();
        });
      }
    } catch (err) {
      /* silently handled */
    }
  }

  function renderNewProjectModal(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-ui-new-project-modal]').forEach(function(container) {
      container.innerHTML =
        '<div class="modal" id="newProjectModal" style="display: none;">' +
          '<div class="modal-overlay" id="newProjectModalOverlay"></div>' +
          '<div class="modal-content">' +
            '<div class="modal-header">' +
              '<h2>Create New Project</h2>' +
              '<button class="modal-close" id="newProjectModalClose">&times;</button>' +
            '</div>' +
            '<div class="modal-body">' +
              '<form id="newProjectForm">' +
                '<div class="form-group">' +
                  '<label for="projectName">Project Name *</label>' +
                  '<input type="text" id="projectName" required maxlength="100" placeholder="My Music Video" />' +
                '</div>' +
                '<div class="form-group">' +
                  '<label for="projectDescription">Description</label>' +
                  '<textarea id="projectDescription" rows="3" maxlength="500" placeholder="A brief description of your project"></textarea>' +
                '</div>' +
              '</form>' +
            '</div>' +
            '<div class="modal-footer">' +
              '<button class="btn btn-secondary" id="cancelNewProject">Cancel</button>' +
              '<button class="btn btn-primary" id="createNewProject">Create Project</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    });
  }

  function renderAnalysisPromptModal(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-ui-analysis-prompt-modal]').forEach(function(container) {
      container.innerHTML =
        '<div class="modal" id="analysisPromptModal" style="display: none;">' +
          '<div class="modal-overlay" id="analysisPromptModalOverlay"></div>' +
          '<div class="modal-content modal-large">' +
            '<div class="modal-header">' +
              '<h2>AI Music Analysis Prompt</h2>' +
              '<button class="modal-close" id="analysisPromptModalClose">&times;</button>' +
            '</div>' +
            '<div class="modal-body">' +
              '<p class="modal-description">Copy this prompt and paste it into another AI (Claude, ChatGPT, etc.) along with your music file. ' +
                'The AI will analyze your music and return a JSON file that you can upload here.</p>' +
              '<div class="prompt-box">' +
                '<button class="btn btn-primary btn-sm copy-prompt-btn" id="copyAnalysisPromptBtn">Copy Prompt</button>' +
                '<pre id="analysisPromptText">Loading prompt...</pre>' +
              '</div>' +
            '</div>' +
            '<div class="modal-footer">' +
              '<button class="btn btn-secondary" id="closeAnalysisPromptModal">Close</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    });
  }

  function renderToastContainer(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-ui-toast-container]').forEach(function(container) {
      container.innerHTML = '<div class="toast-container" id="toastContainer"></div>';
    });
  }

  function renderPageChatMount(root) {
    var scope = root || document;
    if (scope.getElementById && scope.getElementById('globalPageChatMount')) {
      return;
    }
    var mount = createElement('div', 'page-chat-mount');
    mount.id = 'globalPageChatMount';
    scope.body.appendChild(mount);
  }

  // ── Page Transition ──
  function applyPageTransition() {
    var main = document.querySelector('main');
    if (main) main.classList.add('page-transition');
  }

  // ── Step Progress Bar ──
  var STEP_MAP = {
    'step1.html': { num: 1, label: 'Theme' },
    'step2.html': { num: 2, label: 'Music' },
    'step3.html': { num: 3, label: 'Canon' },
    'step4.html': { num: 4, label: 'References' },
    'index.html': { num: 5, label: 'Shots' }
  };

  function renderProgressBar() {
    var path = window.location.pathname.split('/').pop() || '';
    var current = STEP_MAP[path];
    if (!current) return;

    var bar = createElement('div', 'step-progress-bar');
    bar.setAttribute('role', 'navigation');
    bar.setAttribute('aria-label', 'Workflow progress');

    var steps = Object.keys(STEP_MAP);
    steps.forEach(function(key, idx) {
      var step = STEP_MAP[key];
      var segment = createElement('div', 'step-progress-segment');
      if (step.num < current.num) segment.classList.add('completed');
      if (step.num === current.num) segment.classList.add('active');

      var dot = createElement('div', 'step-progress-dot', String(step.num));
      dot.setAttribute('aria-label', 'Step ' + step.num + ': ' + step.label);
      if (step.num === current.num) dot.setAttribute('aria-current', 'step');
      segment.appendChild(dot);

      var label = createElement('span', 'step-progress-label', step.label);
      segment.appendChild(label);

      if (idx < steps.length - 1) {
        segment.appendChild(createElement('div', 'step-progress-line'));
      }

      bar.appendChild(segment);
    });

    var target = document.querySelector('.content-area') || document.querySelector('main');
    if (target) target.insertBefore(bar, target.firstChild);
  }

  // ── Focus Trap (for modals) ──
  function trapFocus(modalElement) {
    var focusable = modalElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return null;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    function handler(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    modalElement.addEventListener('keydown', handler);
    first.focus();
    return function release() {
      modalElement.removeEventListener('keydown', handler);
    };
  }

  // ── Aria-live region for announcements ──
  function renderAriaLiveRegion() {
    if (document.getElementById('uiAriaLive')) return;
    var region = createElement('div', 'sr-only');
    region.id = 'uiAriaLive';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    document.body.appendChild(region);
  }

  function announce(message) {
    var region = document.getElementById('uiAriaLive');
    if (region) region.textContent = message;
  }

  function init() {
    document.documentElement.setAttribute('data-ui-layer', '1');
    persistProjectFromQuery();
    renderNavBrand(document);
    renderProjectSelectorSection(document);
    renderNavStats(document);
    renderNavFooter(document);
    renderWorkflowNavs(document);
    renderResourceNavs(document);
    renderGuideNavs(document);
    hydrateProjectLinks(document);
    renderNewProjectModal(document);
    renderAnalysisPromptModal(document);
    renderToastContainer(document);
    renderPageChatMount(document);
    wireDataNav(document);
    hydrateGuideProjectSelector(document);
    applyPageTransition();
    renderProgressBar();
    renderAriaLiveRegion();
  }

  window.UILayer = {
    init,
    wireDataNav,
    createStatTile,
    renderStatGrid,
    createListItem,
    renderList,
    createShotSidebarItem,
    renderMetaItems,
    renderNavBrand,
    renderProjectSelectorSection,
    renderNavStats,
    renderNavFooter,
    renderWorkflowNavs,
    renderResourceNavs,
    renderGuideNavs,
    renderNewProjectModal,
    renderAnalysisPromptModal,
    renderToastContainer,
    renderPageChatMount,
    trapFocus,
    announce,
    updateStepBadges
  };
})();
