# MNunes Nails · Finanças

Base da Sprint 1 para a aplicação de gestão financeira do salão.

## Executar

Requer **Node.js 24 ou superior**. Não há dependências externas para instalar.

```sh
npm start
```

Abra http://127.0.0.1:3000. Para desenvolvimento com reinício automático do servidor, use `npm run dev`; recarregue o navegador após alterações no front-end.

## Implementado na Sprint 1

- Estrutura de front-end em `public/` e back-end em `server/`.
- Servidor HTTP e API REST com validação dos dados.
- Banco SQLite criado automaticamente, com tabelas de clientes, serviços e lançamentos e chaves estrangeiras.
- Painel com entradas, saídas, saldo e últimos lançamentos por mês.
- Cadastro, listagem e exclusão de lançamentos, clientes e serviços.
- Interface em português, responsiva, com formulários acessíveis e estados vazios.
- Testes de integração da API e de persistência do banco.

O banco inicia vazio, sem valores fictícios. Valores monetários são armazenados em centavos. Ao excluir um cliente, seus lançamentos são preservados e o vínculo é removido. O saldo exibido é o saldo do mês selecionado, não o saldo bancário acumulado.

## Estrutura

```text
public/              Interface HTML, CSS e JavaScript
server/index.js      Servidor e rotas da API
server/database.js   Inicialização do SQLite (schema versão 1)
tests/               Testes automatizados
data/financas.sqlite Banco local (ignorado pelo Git)
```

## API

| Recurso | GET | POST | DELETE |
| --- | --- | --- | --- |
| Clientes | `/api/clients` | `/api/clients` | `/api/clients/:id` |
| Serviços | `/api/services` | `/api/services` | `/api/services/:id` |
| Lançamentos | `/api/transactions` | `/api/transactions` | `/api/transactions/:id` |

Corpos JSON:

```json
{"name":"Ana","phone":"11999999999"}
```

```json
{"name":"Manicure","price":4500}
```

```json
{"description":"Manicure","type":"income","amount":4500,"date":"2026-10-11","category":"Atendimento","client_id":null}
```

`type` aceita `income` ou `expense`. `price` e `amount` são inteiros em centavos. `client_id` é opcional. As listas retornam registros com `id`.

## Verificação

```sh
npm test
```

## Configuração e limites

`PORT` altera a porta (padrão `3000`); `DATABASE_PATH` altera o caminho do SQLite. Para backup, pare o servidor e copie o arquivo do banco. O SQLite utiliza WAL durante a execução.

Esta base é destinada a uso local e escuta somente em `127.0.0.1`. Autenticação, edição de registros, agenda de atendimentos, relatórios e implantação em produção não estão incluídos nesta Sprint. Antes de disponibilizar na internet, é necessário implementar autenticação e controle de acesso.
