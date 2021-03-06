var express = require('express');
var app = express();
var auth = require('./auth'); // HTTP basic authentication
var swig = require('swig'); // templates
var Sequelize = require('sequelize'); // ORM
var bodyParser = require('body-parser');
var _ = require('lodash');

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static('./resources/public', { maxAge: 86400000 }));
app.use('/admin', auth.basicAuth('admin', process.env.SURVEY_ADMIN_PASSWORD));

app.engine('html', swig.renderFile);
app.set('view engine', 'html');
app.set('views', './resources/views');
app.set('view cache', false); // disable swig's cache

var db = new Sequelize(
  process.env.SURVEY_DB_NAME,
  process.env.SURVEY_DB_USER,
  process.env.SURVEY_DB_PASSWORD, {
    host: process.env.SURVEY_DB_HOST,
    dialect: 'postgres'
  });

var host = process.env.SURVEY_WEB_HOST;

var Questionnaire = db.define('questionnaire', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: Sequelize.TEXT
  },
  problem: {
    type: Sequelize.JSONB
  },
  questions: {
    type: Sequelize.JSONB
  }
});

var Result = db.define('result', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  questionnaire_id: {
    type: Sequelize.INTEGER,
    references: {
      model: Questionnaire,
      key: 'id'
    }
  },
  answers: {
    type: Sequelize.JSONB
  },
  url: {
    type: Sequelize.CHAR(8),
    unique: true
  },
  last_visited: {
    type: Sequelize.DATE
  },
  last_completed: {
    type: Sequelize.DATE
  }
});

function questionnaireNotFound(res, id) {
  return function(error) {
    res.status(404).send("Questionnaire " + id + " not found");
  };
}

function surveyNotFound(res, url) {
  return function(error) {
    res.status(404).send("Survey with ID " + url + " not found");
  };
}

function surveyNotFoundPretty(res, url) {
  return function(error) {
    res.status(404).render("surveyNotFound.html", { host: host, url: url });
  };
}

function internalServerError(res) {
  return function (error) {
    console.log(error);
    res.status(500).send(error);
  };
}

app.get('/', function(req, res) {
  res.render('index.html', { host: host });
});

app.get('/admin', function(req, res) {
  Questionnaire.findAll().then(function(qnaires) {
    res.render('admin/home.html', {
      questionnaires: qnaires
    });
  }).catch(internalServerError(res));
});

app.get('/admin/new/edit', function(req, res) {
  res.render('admin/edit.html', {
    questionnaire_id: "new"
  });
});

app.get('/admin/:id/edit', function(req, res) {
  Questionnaire.findById(req.params.id).then(function(qnaire) {
    res.render('admin/edit.html', {
      questionnaire_id: qnaire.id,
      questionnaire: {
        title: qnaire.title,
        problem: JSON.stringify(qnaire.problem, null, 2),
        questions: JSON.stringify(qnaire.questions, null, 2)
      }
    });
  }).catch(questionnaireNotFound(res, req.params.id));
});

app.post('/admin/new', function(req, res) {
  var data = {
    title: req.body.title,
    problem: JSON.parse(req.body.problem),
    questions: JSON.parse(req.body.questions)
  };
  Questionnaire.create(data).then(function(qnaire) {
    res.redirect('/admin/' + qnaire.get('id'));
  }).catch(internalServerError(res));
});

app.post('/admin/:id', function(req, res) {
  Questionnaire.findById(req.params.id).then(function(qnaire) {
    qnaire.update({
      title: req.body.title,
      problem: JSON.parse(req.body.problem),
      questions: JSON.parse(req.body.questions)
    }).then(function() {
      res.redirect('/admin/' + qnaire.get('id'));
    }).catch(internalServerError(res));
  }).catch(questionnaireNotFound(res, req.params.id));
});

function randomToken() {
  return Math.random().toString(36).substring(2,10);
}

app.post('/admin/:id/generate-urls', function(req, res) {
  Questionnaire.findById(req.params.id).then(function(qnaire) {
    var qnaires = [];
    for (var i = 0; i < req.body.urls; ++i) {
      qnaires.push({ questionnaire_id: req.params.id,
                     url: randomToken() });
    }
    Result.bulkCreate(qnaires).then(function() {
      res.redirect('/admin/' + req.params.id);
      res.end();
    }).catch(internalServerError(res));
  }).catch(questionnaireNotFound(res, req.params.id));
});

app.get('/admin/:id', function(req, res) {
  Questionnaire.findById(req.params.id).then(function(qnaire) {
    Result.findAll({"where": {"questionnaire_id": req.params.id}}).then(function(results) {
      res.render('admin/view.html', {
        questionnaire: qnaire,
        results: results
      });
    }).catch(internalServerError(res));
  }).catch(internalServerError(res));
});

app.get('/admin/:id/export-urls', function(req, res) {
  Questionnaire.findById(req.params.id).then(function(qnaire) {
    Result.findAll({"where": {"questionnaire_id": req.params.id}}).then(function(results) {
      var urls = _.map(results, function(r) { return host + "/" + r.url});
      res.send(urls.join("\r\n"));
    }).catch(internalServerError(res));
  }).catch(internalServerError(res));
});

app.get('/admin/:id/export-results', function(req, res) {
  Questionnaire.findById(req.params.id).then(function(qnaire) {
    Result.findAll({"where": {"questionnaire_id": req.params.id}}).then(function(results) {
      res.send(JSON.stringify(results));
    }).catch(internalServerError(res));
  }).catch(internalServerError(res));
});

app.get('/:survey', function(req, res) {
  Result.find({"where": {"url": req.params.survey}}).then(function(survey) {
    Questionnaire.findById(survey.questionnaire_id).then(function(qnaire) {
      survey.last_visited = new Date();
      survey.save().then(function(){ console.log("updated") });
      res.render('home.html', {
        info: {
          id: req.params.survey,
          title: qnaire.title,
          problem: qnaire.problem,
          questions: qnaire.questions,
          answers: survey.answers,
          lastVisited: survey.last_visited,
          lastSaved: survey.last_completed
        }
      });
    }).catch(questionnaireNotFound(res, survey.questionnaire_id));
  }).catch(surveyNotFoundPretty(res, req.params.survey));
});

app.post('/:survey', function(req, res) {
  Result.find({"where": {"url": req.params.survey}}).then(function(survey) {
    survey.answers = req.body;
    survey.last_completed = new Date();
    survey.save().then(function() {
      res.sendStatus(200);
    }).catch(internalServerError(res));
  }).catch(surveyNotFound(res, req.params.survey));
});

Questionnaire.sync().then(function() {
  Result.sync().then(function() {
    app.listen(8080);
  });
});
