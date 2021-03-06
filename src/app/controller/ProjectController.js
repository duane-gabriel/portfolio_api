const models = require('../model');
const { toDate, format } = require('date-fns');
const pt = require('date-fns/locale/pt');
class ProjectController {
  constructor() {}
  async index(req, res) {
    const projects = await models.Projects.findAll({
      order: [['position', 'ASC']],
      include: [
        {
          model: models.Files,
          attributes: ['name', 'path', 'url', 'star'],
        },
        {
          model: models.Technologies,
          attributes: ['id', 'name'],
          through: {
            attributes: [],
          },
        },
      ],
      attributes: [
        'id',
        'name',
        'description',
        'date',
        'link',
        'repository',
        'position',
      ],
    });

    return res.json(projects);
  }

  async store(req, res) {
    try {
      req.body.date = toDate(Number(req.body.date));
      req.body.position = Number(await models.Projects.max('position')) + 1;

      let { technologies, indexFileStar } = req.body;

      const project = await models.Projects.create(req.body);

      req.files.forEach(async (file, index) => {
        let { originalname: name, key: path, location: url = '' } = file;

        let obj = { name, path, project_id: project.id, url };
        if (Number(indexFileStar) === index) {
          obj = { ...obj, star: true };
        }
        await models.Files.create(obj);
      });

      if (Array.isArray(technologies)) {
        technologies.forEach(async (tec) => {
          try {
            let existsTag = await models.Technologies.findOne({
              where: {
                name: tec.toLowerCase(),
              },
            });

            if (existsTag) {
              await models.ProjectsTechnologies.create({
                project_id: project.id,
                technologie_id: existsTag.id,
              });
              return;
            }

            let newTag = await models.Technologies.create({ name: tec });

            await models.ProjectsTechnologies.create({
              project_id: project.id,
              technologie_id: newTag.id,
            });
          } catch (e) {
            console.log(e);
          }
        });
      } else if (technologies) {
        let existsTag = await models.Technologies.findOne({
          where: {
            name: technologies.toLowerCase(),
          },
        });
        if (existsTag) {
          await models.ProjectsTechnologies.create({
            project_id: project.id,
            technologie_id: existsTag.id,
          });
        } else {
          let newTag = await models.Technologies.create({ name: technologies });

          await models.ProjectsTechnologies.create({
            project_id: project.id,
            technologie_id: newTag.id,
          });
        }
      }
      return res.json(project);
    } catch (e) {
      console.log(e);
      res.json({ error: 'error' });
    }
  }

  async update(req, res) {
    try {
      if (req.body.date) req.body.date = toDate(Number(req.body.date));
      let {
        Technologies: technologies,
        indexFileStar,
        id,
        Files,
        filesUpload,
        date,
        description,
        link,
        name,
        repository,
        position,
      } = req.body;

      const project = await models.Projects.update(
        { name, description, link, repository, date, position },
        {
          where: {
            id,
          },
        }
      );
      if (Files) {
        const registeredFiles = await models.Files.findAll({
          where: {
            project_id: id,
          },
        });
        let deleteFile = true;
        registeredFiles.forEach(async (rf) => {
          Files.forEach((cf) => {
            if (rf.path == cf.path) {
              deleteFile = false;
            }
          });
          if (deleteFile) {
            await models.Files.destroy({
              where: {
                path: rf.path,
                project_id: id,
              },
            });
          }
          deleteFile = true;
        });

        Files.forEach(async (file, index) => {
          let { path, name } = file;

          let variable = { star: false };
          if (Number(indexFileStar) === index) {
            variable.star = true;
          }
          await models.Files.update(variable, {
            where: {
              name,
              path,
              project_id: id,
            },
          });
        });
      }

      if (filesUpload) {
        filesUpload.forEach(async (file, index) => {
          let { key: path, location: url, originalname: name } = file;

          let existsFile = await models.Files.findOne({ where: { name, url } });

          let obj = { name, path, project_id: id, url, star: false };
          if (Number(indexFileStar) === index) {
            obj.star = true;
          }
          if (existsFile) {
            let variable = { star: false };
            if (Number(indexFileStar) === index) {
              variable.star = true;
            }
            await models.Files.update(variable, {
              where: {
                name,
                path,
                project_id: id,
              },
            });
            return;
          }

          await models.Files.create(obj);
        });
      }

      if (technologies) {
        let tagsAlreadyInserted = await models.ProjectsTechnologies.findAll({
          where: {
            project_id: id,
          },
        });

        let tagOk = false;

        tagsAlreadyInserted.forEach((tagAlIns) => {
          technologies.forEach((newTags) => {
            if (tagAlIns.technologie_id === Number(newTags.id)) {
              tagOk = true;
            }
          });
          if (!tagOk) {
            models.ProjectsTechnologies.destroy({
              where: {
                technologie_id: tagAlIns.technologie_id,
                project_id: id,
              },
            });
          }
          tagOk = false;
        });

        technologies.forEach(async (tec) => {
          let existsTag = await models.Technologies.findOne({
            where: {
              name: tec.text,
            },
          });

          if (existsTag) {
            let isCadastred = await models.ProjectsTechnologies.findOne({
              where: {
                project_id: id,
                technologie_id: existsTag.id,
              },
            });
            if (!isCadastred) {
              await models.ProjectsTechnologies.create({
                project_id: id,
                technologie_id: existsTag.id,
              });
            }
            return;
          }

          let newTag = await models.Technologies.create({ name: tec.text });

          await models.ProjectsTechnologies.create({
            project_id: id,
            technologie_id: newTag.id,
          });
        });
      }
      return res.json({ status: 'ok' });
    } catch (e) {
      console.log(e);
    }
  }

  async delete(req, res) {
    const { id } = req.params;
    const project = await models.Projects.findOne({
      where: {
        id,
      },
    });

    if (!project) {
      return res.json({ error: 'Project does not exists' });
    }

    await models.Files.destroy({
      where: { project_id: id },
      individualHooks: true,
    });
    await models.ProjectsTechnologies.destroy({ where: { project_id: id } });
    await models.Projects.destroy({ where: { id } });

    return res.json(id);
  }
}

module.exports = new ProjectController();
