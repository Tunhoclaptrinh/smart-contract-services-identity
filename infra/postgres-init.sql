-- One database and one login per service (MS-R2): a service can only reach its own data.
-- Runs once, when the postgres volume is created (docker-entrypoint-initdb.d). Passwords here are
-- for the local demo stack; a deployment creates its own.
CREATE ROLE identity LOGIN PASSWORD 'identity-dev';
CREATE DATABASE identity OWNER identity;
CREATE ROLE contract LOGIN PASSWORD 'contract-dev';
CREATE DATABASE contract OWNER contract;
CREATE ROLE signing LOGIN PASSWORD 'signing-dev';
CREATE DATABASE signing OWNER signing;
CREATE ROLE execution LOGIN PASSWORD 'execution-dev';
CREATE DATABASE execution OWNER execution;
CREATE ROLE decision LOGIN PASSWORD 'decision-dev';
CREATE DATABASE decision OWNER decision;
CREATE ROLE payment LOGIN PASSWORD 'payment-dev';
CREATE DATABASE payment OWNER payment;
CREATE ROLE audit LOGIN PASSWORD 'audit-dev';
CREATE DATABASE audit OWNER audit;
-- No service may connect to another's database.
REVOKE CONNECT ON DATABASE identity, contract, signing, execution, decision, payment, audit FROM PUBLIC;
GRANT CONNECT ON DATABASE identity TO identity;
GRANT CONNECT ON DATABASE contract TO contract;
GRANT CONNECT ON DATABASE signing TO signing;
GRANT CONNECT ON DATABASE execution TO execution;
GRANT CONNECT ON DATABASE decision TO decision;
GRANT CONNECT ON DATABASE payment TO payment;
GRANT CONNECT ON DATABASE audit TO audit;
