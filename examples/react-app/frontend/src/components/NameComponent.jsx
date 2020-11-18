import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import TextField from '@material-ui/core/TextField';
import axios from 'axios';
import moment from 'moment';
import getConfig from 'next/config';
import React from 'react';

class NameComponent extends React.Component {
  constructor(props) {
    super(props);

    const { publicRuntimeConfig } = getConfig();
    const { WORLD_TEXT } = publicRuntimeConfig;

    this.api = axios.create({ baseURL: '/api' });

    this.state = {
      changed_name: WORLD_TEXT,
      name_changes: []
    };
  }

  async componentDidMount() {
    const name_changes = await this.get_names();
    this.setState({ name_changes });
    if (name_changes.length) {
      this.setState({ changed_name: name_changes[0].name });
    }
  }

  async post_name() {
    const res = await this.api.post('/names', { name: this.state.changed_name });
    const name_changes = this.state.name_changes;
    name_changes.unshift(res.data);
    this.setState({ name_changes });
  };

  change_name(e) {
    this.setState({ changed_name: e.target.value });
  }

  async get_names() {
    const res = await this.api.get('/names');
    return res.data;
  };

  render() {
    return (
      <div>
        <p>
          Hello {this.state.changed_name}
        </p>
        <div>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField id="name-text-field" label="Change name" onChange={this.change_name.bind(this)} />
              <Button id="submit-button" variant="contained" onClick={this.post_name.bind(this)}>Change</Button>
            </Grid>
          </Grid>
        </div>
        <div>
          <Table size="small" aria-label="name changes">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell align="right">Name</TableCell>
                <TableCell align="right">Created at</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(this.state.name_changes || []).map(row => (
                <TableRow key={row.id}>
                  <TableCell component="th" scope="row">
                    {row.id}
                  </TableCell>
                  <TableCell align="right">{row.name}</TableCell>
                  <TableCell align="right">{moment(new Date(row.createdAt)).format("M/DD/YYYY, h:mm:ss a")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }
}

export default NameComponent;
