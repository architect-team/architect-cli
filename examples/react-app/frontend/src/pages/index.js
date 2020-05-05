import blue from '@material-ui/core/colors/blue';
import { createMuiTheme, ThemeProvider } from '@material-ui/core/styles';
import Head from 'next/head';
import React from 'react';
import NameComponent from './../components/NameComponent';

const theme = createMuiTheme({
  palette: {
    type: 'dark',
    primary: blue,
    secondary: blue
  }
});

const Home = () => (
  <ThemeProvider theme={theme}>
    <div className="container">
      <Head>
        <title>React Demo</title>
        <link rel="icon" href="/img/favicon.ico" />
      </Head>

      <main>
        <div className="App-header">
          <img src="/img/logo.svg" className="App-logo" alt="logo" />
          <NameComponent />
        </div>
      </main>

      <style jsx>{`
      .App {
        text-align: center;
      }

      .App-logo {
        height: 40vmin;
        pointer-events: none;
      }

      @media (prefers-reduced-motion: no-preference) {
        .App-logo {
          animation: App-logo-spin infinite 20s linear;
        }
      }

      .App-header {
        background-color: #282c34;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-size: calc(10px + 2vmin);
        color: white;
      }

      .App-link {
        color: #61dafb;
      }

      @keyframes App-logo-spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
    `}</style>

      <style jsx global>{`
      html,
      body {
        padding: 0;
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen,
          Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif;
      }

      * {
        box-sizing: border-box;
      }
    `}</style>
    </div>
  </ThemeProvider>
)

Home.getInitialProps = async ctx => {
  return {};
}

export default Home
