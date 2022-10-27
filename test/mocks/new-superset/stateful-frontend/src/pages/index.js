import { Button, Container, Grid, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@material-ui/core';
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
  const [signIns, setSignInData] = React.useState([]);

  React.useEffect(() => {
    fetch('/api/sign-ins')
      .then(res => res.json())
      .then(data => {
        setSignInData(data);
      });
  }, []);

  const signIn = (event) => {
    event.preventDefault();
    fetch('/api/sign-ins', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: event.target.name.value,
      }),
    })
      .then(res => res.json())
      .then(data => {
        setSignInData([...signIns, data]);
      });
  };

  return (
    <Container className={classes.container}>
      <Head>
        <title>Stateful components | Architect examples</title>
        <link rel="icon" href="/img/favicon.ico" />
      </Head>

      <Grid container justify="center" alignItems="center" style={{ height: '100%' }}>
        <Grid item>
          <div className={classes.header}>
            <img src="/img/logo.svg" className={classes.logo} alt="logo" />
          </div>

          <form onSubmit={signIn} method="POST">
            <TextField id="name" name="name" />

            <Button variant="contained" color="primary" type="submit">Sign in</Button>
          </form>

          <Typography variant="h5" style={{ marginBottom: 15 }}>
            Sign ins
          </Typography>
          <TableContainer component={Paper} style={{ width: '100%' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {signIns.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.createdAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Home
