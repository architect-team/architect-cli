exports.runMigration = async (sequelize, logger) => {
  const DB_NAME = sequelize.getDatabaseName();

  try {
    const result = await sequelize.query(`select exists(SELECT datname FROM pg_catalog.pg_database WHERE lower(datname) = lower('${DB_NAME}'));`);
    if (!result[0][0].exists) {
      logger.info('Creating database');
      await sequelize.query(`CREATE DATABASE "${DB_NAME}"`);
    } else {
      logger.info('Database already exists');
    }
  } catch (err) {
    logger.error(`Sequelize init failed\n${err}`);
    throw err;
  }

  try {
    await sequelize.sync();
  } catch (error) {
    logger.error(`Sequelize sync failed\n${error}`);
    throw error;
  }
};
