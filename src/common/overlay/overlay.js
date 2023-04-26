var Architect = {};

Architect.copyToClipboard = function (element, text) {
  navigator.clipboard.writeText(text);

  const tooltipText = element.querySelector('.tooltiptext');

  if (!tooltipText.dataset.text) {
    tooltipText.dataset.text = tooltipText.innerHTML;
  }

  tooltipText.innerHTML = 'Copied to clipboard!';
};

Architect.outFunc = function (element) {
  const tooltipText = element.querySelector('.tooltiptext');
  if (tooltipText.dataset.text) {
    tooltipText.innerHTML = tooltipText.dataset.text;
  }
};

Architect.appendHTML = function () {
  // Don't inject the overlay if it already exists
  const overlay = document.querySelector('#architect-overlay');
  if (overlay) {
    return;
  }

  const script = document.querySelector('#architect-script');
  const environment = script.dataset.environment;
  const service = script.dataset.service;

  var styles = document.createElement('style');
  styles.innerHTML = `
    #architect-overlay {
      position: fixed;
      bottom: 0px;
      right: 0px;
      font-family: sans-serif;
    }

    #architect-overlay .dropdown-content {
      display: none;
      position: fixed;
      min-width: 200px;
      margin-left: -135px;
      transform: translate(0%, -100%) !important;
      box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
      z-index: 1;
    }

    #architect-overlay .dropdown-content a {
      background-color: #225560;
      color: white;
      padding: 12px 16px;
      text-decoration: none;
      display: block;
    }

    #architect-overlay .dropdown-content a:hover {
      background-color: #368798;
    }

    #architect-overlay:hover .dropdown-content {
      display: block;
    }

    #architect-overlay .dropdown-button {
      width: 65px;
      height: 50px;
      border-top-left-radius: 5px;
      background-color: #225560;
      display: flex;
      justify-content: center;
    }

    #architect-overlay .dropdown-button svg {
      fill: #55cb64;
      width: 35px;
    }

    #architect-overlay:hover .dropdown-button {
      border-top-left-radius: 0px;
    }

     #architect-overlay:hover .dropdown-button svg {
      filter: brightness(125%);
    }

    #architect-overlay .tooltip {
      position: relative;
    }

    #architect-overlay .tooltip .tooltiptext {
      visibility: hidden;
      width: 260px;
      background-color: #555;
      color: #fff;
      text-align: center;
      border-radius: 6px;
      padding: 8px 0;

      /* Position the tooltip */
      position: absolute;
      z-index: 1;
      top: 5px;
      right: 105%;
    }

    #architect-overlay .tooltip:hover .tooltiptext {
      visibility: visible;
    }

    #architect-overlay .tooltip .tooltiptext::after {
      content: " ";
      position: absolute;
      top: 50%;
      left: 100%; /* To the right of the tooltip */
      margin-top: -5px;
      border-width: 5px;
      border-style: solid;
      border-color: transparent transparent transparent #555;
    }
  `;
  document.body.append(styles);

  var wrapper = document.createElement('div');
  wrapper.id = 'architect-overlay';
  wrapper.innerHTML = `
    <div class="dropdown-content">
      <div class="tooltip">
        <a href="#" onclick="Architect.copyToClipboard(this, 'architect logs -e ${environment} ${service}')" onmouseout="Architect.outFunc(this)" style="border-top-left-radius: 5px;">
          <span class="tooltiptext">View the logs from the CLI</span>
          Logs
        </a>
      </div>

      <div class="tooltip">
        <a href="#" onclick="Architect.copyToClipboard(this, 'architect exec -e ${environment} ${service} -- ls')" onmouseout="Architect.outFunc(this)">
          <span class="tooltiptext">Execute a command from the CLI</span>
          Exec
        </a>

      </div>

      <div class="tooltip">
        <a href="#" onclick="Architect.copyToClipboard(this, 'architect dev:restart -e ${environment} ${service}')" onmouseout="Architect.outFunc(this)">
          <span class="tooltiptext">Restart this service from the CLI</span>
          Restart
        </a>
      </div>

      <a href="https://docs.architect.io" target="_blank">Documentation</a>
      <a href="https://www.architect.io" target="_blank" style="border-bottom-left-radius: 5px;">Deployed with Architect</a>
    </div>
    <div class="dropdown-button">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 158.5882 111.9446">
        <path d="M118.3551,37.5464V0H40.581L0,74.3982H40.2332v37.5464h77.7742l40.5808-74.3982ZM77.7829,111.9273V74.3949H40.2357L80.8054.0173V37.55h37.5471Z"/>
      </svg>
    </div>
  `;
  document.body.append(wrapper);
};

Architect.appendHTML();
