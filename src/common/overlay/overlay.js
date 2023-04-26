function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
}

function appendHTML() {
  // Don't inject the overlay if it already exists
  const overlay = document.querySelector('#architect-overlay');
  if (overlay) {
    return;
  }

  var styles = document.createElement('style');
  styles.innerHTML = `
    #architect-overlay {
      position: absolute;
      bottom: 0px;
      right: 0px;
      font-family: sans-serif;
    }

    #architect-overlay .dropdown-content {
      display: none;
      position: absolute;
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

    #architect-overlay .dropdown-content a:first-child {
      border-top-left-radius: 5px;
    }

    #architect-overlay .dropdown-content a:last-child {
      border-bottom-left-radius: 5px;
    }

    #architect-overlay .dropdown-content a:hover {
      filter: brightness(125%);
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
  `;
  document.body.append(styles);

  var wrapper = document.createElement('div');
  wrapper.id = 'architect-overlay';
  wrapper.innerHTML = `
    <div class="dropdown-content">
      <a href="#" onclick="copyToClipboard('architect logs')">Logs (CLI)</a>
      <a href="#" onclick="copyToClipboard('architect exec')">Exec (CLI)</a>
      <a href="#" onclick="copyToClipboard('architect dev:restart')">Restart (CLI)</a>
      <a href="https://docs.architect.io" target="_blank">Docs</a>
      <a href="https://www.architect.io" target="_blank">Deployed with Architect</a>
    </div>
    <div class="dropdown-button">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 158.5882 111.9446">
        <path d="M118.3551,37.5464V0H40.581L0,74.3982H40.2332v37.5464h77.7742l40.5808-74.3982ZM77.7829,111.9273V74.3949H40.2357L80.8054.0173V37.55h37.5471Z"/>
      </svg>
    </div>

  `;
  document.body.append(wrapper);
}

appendHTML();
