import config from '../config/index.js';

const request = (url, method = 'GET', data = null) => {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${config.backendUrl}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
      },
      success: (res) => resolve(res.data),
      fail: (err) => reject(err),
    });
  });
};

export default request;