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
      const includeCreate = mode !== 'basic';
      container.innerHTML = '';

      const header = createElement('div', 'nav-header');
      header.appendChild(createElement('div', 'nav-title', 'Current Project'));
      if (includeCreate) {
        const add = createElement('button', 'btn-icon', '+');
        add.id = 'newProjectBtn';
        add.type = 'button';
        add.title = 'New Project';
        header.appendChild(add);
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
      const mode = container.getAttribute('data-ui-mode') || 'standard';
      container.innerHTML = '';
      if (mode === 'storyboard') {
        container.appendChild(createStatItem('stat-total-shots', 'Total Shots'));
        container.appendChild(createStatItem('stat-rendered', 'Rendered'));
        container.appendChild(createStatItem('stat-selected', 'Selected', 'nav-stat-success'));
        container.appendChild(createStatItem('stat-duration', 'Duration'));
        return;
      }
      container.appendChild(createStatItem('stat-shots', 'Shots'));
      container.appendChild(createStatItem('stat-prompts', 'Shot Files'));
      container.appendChild(createStatItem('stat-passed', 'Passed', 'nav-stat-success'));
      container.appendChild(createStatItem('stat-failed', 'Failed', 'nav-stat-error'));
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
        const url = el.getAttribute('data-nav-url') || el.getAttribute('data-workspace-url');
        if (url) {
          window.location.href = url;
        }
      });
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

    return button;
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
    } catch {
      // Keep the selector in its loading/fallback state if service hydration fails.
    }
  }

  function init() {
    document.documentElement.setAttribute('data-ui-layer', '1');
    renderNavBrand(document);
    renderProjectSelectorSection(document);
    renderNavStats(document);
    renderNavFooter(document);
    renderWorkflowNavs(document);
    renderResourceNavs(document);
    renderGuideNavs(document);
    wireDataNav(document);
    hydrateGuideProjectSelector(document);
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
    renderGuideNavs
  };
})();
