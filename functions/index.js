const functions = require('firebase-functions');
const cors=require('cors')
const express=require('express')
const app=express()
app.use(cors())
const {db} =require('./util/admin')
const FBAuth= require('./util/fbauth')
const {getAllScreams, postOneScream, getScream, deleteScream, commentOnScream, likeScream, unlikeScream}= require('./handlers/screams')
const {signup, login, uploadImage, addUserDetails, markNotificationsRead,getAuthenticatedUser, getUserDetails}=require('./handlers/users')



// GET ALL SCREAMS FROM DB
app.get('/screams', getAllScreams)
// POSTING A NEW SCREAM
app.post('/scream', FBAuth, postOneScream)
app.get('/scream/:screamId', getScream)
app.post('/scream/:screamId/comment', FBAuth, commentOnScream)
app.get('/scream/:screamId/like', FBAuth, likeScream)
app.get('/scream/:screamId/unlike', FBAuth, unlikeScream)
app.delete('/scream/:screamId', FBAuth, deleteScream)
//USER ROUTES
app.post('/user', FBAuth, addUserDetails)
app.get('/user', FBAuth, getAuthenticatedUser)
app.get('/user/:handle', getUserDetails)
app.post('/notifications', FBAuth, markNotificationsRead)
// Sign UP ROUTE
app.post('/signup', signup)
// LOGIN
app.post('/login', login)

//IMAGE UPLOAD
app.post('/user/image', FBAuth,uploadImage)

exports.api = functions.https.onRequest(app)

//CREATE NOTIFICATION ON LIKE
exports.createNotificationOnLike= functions.region('us-central1').firestore.document('likes/{id}')
.onCreate((snapshot) => {
    return db.doc(`/screams/${snapshot.data().screamId}`).get()
    .then(doc => {
        if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
            return db.doc(`/notifications/${snapshot.id}`).set({
                createdAt: new Date().toISOString(),
                recipient: doc.data().userHandle,
                sender: snapshot.data().userHandle,
                type: 'like',
                read: false,
                screamId: doc.id
            })
        }
    })
    .catch( err => {
        console.log(err);
    })
})

exports.createNotificationOnComment = functions.region('us-central1').firestore.document('comments/{id}')
    .onCreate( (snapshot) => {
    return db.doc(`/screams/${snapshot.data().screamId}`).get()
    .then(doc => {
        if(doc.exists  && doc.data().userHandle !== snapshot.data().userHandle){
            return db.doc(`/notifications/${snapshot.id}`).set({
                createdAt: new Date().toISOString(),
                recipient: doc.data().userHandle,
                sender: snapshot.data().userHandle,
                type: 'comment',
                read: false,
                screamId: doc.id
            })
        }
    })
    .catch( err => {
        console.log(err);
        return;
    })

})

exports.deleteNotificationOnUnLike=  functions.region('us-central1').firestore.document('likes/{id}')
.onDelete((snapshot) => {
    return db.doc(`/notifications/${snapshot.id}`)
    .delete()
    .catch(err => {
        return
    })
})

//TRIGGER TO CHANGE USER IMAGE
exports.onUserImageChange= functions.region('us-central1').firestore.document('/users/{userId}')
    .onUpdate( (change) => {
        if(change.before.data().imageUrl !== change.after.data().imageUrl){
            let batch= db.batch()
            return db.collection('screams').where('userHandle', '==', change.before.data().handle).get()
                .then((data)=> {
                    data.forEach((doc)=>{
                        const scream= db.doc(`/screams/${doc.id}`)
                        batch.update(scream, {userImage: change.after.data().imageUrl})
                    })
                    return batch.commit()
                })
            
        } else{
            return true;
        }
    })

//TRIGGER TO DELETE ALL DETIALS RELATING TO A DELETED SCREAM
exports.onScreamDelete = functions.region('us-central1').firestore.document('/screams/{screamId}')
.onDelete((snapshot, context) => {
    const screamId = context.params.screamId
    const batch= db.batch()
    return db.collection('comments').where('screamId', "==", screamId).get()
    .then( data=> {
        data.forEach(doc => {
            batch.delete(db.doc(`/comments/${doc.id}`))
        })
        return db.collection('likes').where("screamId", '==', screamId).get()
    })
    .then( data=> {
        data.forEach(doc => {
            batch.delete(db.doc(`/likes/${doc.id}`))
        })
        return  db.collection('notifications').where("screamId", '==', screamId).get()
    })
        .then( data => {
        data.forEach(doc => {
            batch.delete(db.doc(`/notifications/${doc.id}`))
        })
        return batch.commit()
    })
    .catch(err => {
        console.error(err);

    })
})