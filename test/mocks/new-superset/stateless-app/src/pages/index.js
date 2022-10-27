import { Button, Container, Grid, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import Head from 'next/head';
import React from 'react';

const useStyles = makeStyles(theme => ({
  container: {
    textAlign: 'center',
    height: '100%',
  },

  header: {
    fontSize: 'calc(10px + 2vmin)',
    color: 'white',
  },

  link: {
    color: '#61dafb',
  },

  logo: {
    height: '40vmin',
    pointerEvents: 'none',

    '@media (prefers-reduced-motion: no-preference)': {
      '&': {
        animation: 'logo-spin infinite 20s linear',
      }
    }
  },

  '@keyframes logo-spin': {
    from: {
      transform: 'rotate(0deg)',
    },
    to: {
      transform: 'rotate(360deg)',
    }
  }
}));

const Home = () => {
  const classes = useStyles();
  const [echoRes, setEchoRes] = React.useState('');

  const onClick = () => {
    fetch('/hello')
      .then(res => res.text())
      .then(data => {
        setEchoRes(data);
      });
  };

  return (
    <Container className={classes.container}>
      <Head>
        <title>Stateless components | Architect examples</title>
        <link rel="icon" href="/img/favicon.ico" />
      </Head>

      <Grid container justify="center" alignItems="center" style={{ height: '100%' }}>
        <Grid item>
          <div className={classes.header}>
            <img src="/img/logo.svg" className={classes.logo} alt="logo" />
          </div>

          <Button
            variant="contained"
            onClick={onClick}
            style={{
              marginBottom: 15,
            }}
          >
            Call echo server
          </Button>
          <Typography variant="h5" style={{ marginBottom: 15 }}>
            Echo response
          </Typography>
          <div>{echoRes}</div>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Home
