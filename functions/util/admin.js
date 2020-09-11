const admin= require('firebase-admin');
const { storageBucket } = require('./config');
// admin.initializeApp()
admin.initializeApp({
    credential: admin.credential.cert(require('./admin.json')),
    storageBucket: "gs://social-media-app-3db1f.appspot.com"
});
const db=admin.firestore()


module.exports= {admin, db}