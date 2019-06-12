'''
    Main Bottle and routings for the LabelUI web frontend.

    2019 Amrita Gupta, Benjamin Kellenberger
'''

import os
from bottle import request, static_file
from .backend.middleware import DBMiddleware


class LabelUI():

    def __init__(self, config, app):
        self.config = config
        self.app = app
        self.staticDir = self.config.getProperty(self, 'staticfiles_dir')
        self.middleware = DBMiddleware(config)

        self._initBottle()


    def _initBottle(self):

        ''' static routings '''
        @self.app.route('/')
        def index():
            return static_file("index.html", root=os.path.join(self.staticDir, 'html'))


        @self.app.route('/interface')
        def interface():
            return static_file("interface.html", root=os.path.join(self.staticDir, 'html'))


        @self.app.route('/<filename:re:.*_IMG_.*\.JPG$>')
        def send_img(filename):
            return static_file(filename, root=os.path.join(self.staticDir, 'img'))

        
        @self.app.route('/<filename:re:.*>')
        def send_static(filename):
            return static_file(filename, root=self.staticDir)


        ''' dynamic routings '''
        @self.app.get('/getProjectSettings')
        def get_project_settings():
            settings = {
                'settings': self.middleware.getProjectSettings()
            }
            return settings

        @self.app.get('/getClassDefinitions')
        def get_class_definitions():
            classDefs = {
                'classes': self.middleware.getClassDefinitions()
            }
            return classDefs


        @self.app.post('/getImages')
        def get_images():
            postData = request.body.read()
            dataIDs = postData['imageIDs']
            json = self.middleware.getBatch(dataIDs)
            return json


        @self.app.get('/getLatestImages')
        def get_latest_images():
            try:
                limit = int(request.query['limit'])
            except:
                limit = None
            try:
                ignoreLabeled = int(request.query['ignoreLabeled'])
            except:
                ignoreLabeled = False
            json = self.middleware.getNextBatch(ignoreLabeled=ignoreLabeled, limit=limit)       #TODO
            return json


        @self.app.post('/submitAnnotations')
        def submit_annotations():
            # parse
            try:
                submission = request.json
                response = self.middleware.submitAnnotations(submission)
                return response
            except Exception as e:
                print('ERROR: ' + str(e))
                return { 'error': str(e) }




''' Convenience launcher (FOR DEBUGGING ONLY) '''
if __name__ == '__main__':
    
    import argparse
    from runserver import Launcher

    parser = argparse.ArgumentParser(description='Run CV4Wildlife AL Service.')
    parser.add_argument('--instance', type=str, default='LabelUI', const=1, nargs='?')
    args = parser.parse_args()
    Launcher(args)