var Notification = require('../models/notification');


exports.list = function (req, res) {

    Notification.find({"receivers.account": req.user._id})
        .sort('createdAt')
        .populate({
            path: 'modelRef',
            populate:{
                path:'property',
            },
        })
        .exec(function (err, notifications) {
            if (err) {
                return next(err);
            }
            //Successful, so render
            res.render('notification/list', {title: 'Notifications', 'notifications': notifications});
        });


};


