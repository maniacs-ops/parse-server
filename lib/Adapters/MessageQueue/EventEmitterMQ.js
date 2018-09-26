'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.EventEmitterMQ = undefined;

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const emitter = new _events2.default.EventEmitter();
const subscriptions = new Map();

function unsubscribe(channel) {
  if (!subscriptions.has(channel)) {
    //console.log('No channel to unsub from');
    return;
  }
  //console.log('unsub ', channel);
  emitter.removeListener(channel, subscriptions.get(channel));
  subscriptions.delete(channel);
}

class Publisher {

  constructor(emitter) {
    this.emitter = emitter;
  }

  publish(channel, message) {
    this.emitter.emit(channel, message);
  }
}

class Consumer extends _events2.default.EventEmitter {

  constructor(emitter) {
    super();
    this.emitter = emitter;
  }

  subscribe(channel) {
    unsubscribe(channel);
    const handler = message => {
      this.emit('message', channel, message);
    };
    subscriptions.set(channel, handler);
    this.emitter.on(channel, handler);
  }

  unsubscribe(channel) {
    unsubscribe(channel);
  }
}

function createPublisher() {
  return new Publisher(emitter);
}

function createSubscriber() {
  return new Consumer(emitter);
}

const EventEmitterMQ = {
  createPublisher,
  createSubscriber
};

exports.EventEmitterMQ = EventEmitterMQ;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9BZGFwdGVycy9NZXNzYWdlUXVldWUvRXZlbnRFbWl0dGVyTVEuanMiXSwibmFtZXMiOlsiZW1pdHRlciIsImV2ZW50cyIsIkV2ZW50RW1pdHRlciIsInN1YnNjcmlwdGlvbnMiLCJNYXAiLCJ1bnN1YnNjcmliZSIsImNoYW5uZWwiLCJoYXMiLCJyZW1vdmVMaXN0ZW5lciIsImdldCIsImRlbGV0ZSIsIlB1Ymxpc2hlciIsImNvbnN0cnVjdG9yIiwicHVibGlzaCIsIm1lc3NhZ2UiLCJlbWl0IiwiQ29uc3VtZXIiLCJzdWJzY3JpYmUiLCJoYW5kbGVyIiwic2V0Iiwib24iLCJjcmVhdGVQdWJsaXNoZXIiLCJjcmVhdGVTdWJzY3JpYmVyIiwiRXZlbnRFbWl0dGVyTVEiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQTs7Ozs7O0FBRUEsTUFBTUEsVUFBVSxJQUFJQyxpQkFBT0MsWUFBWCxFQUFoQjtBQUNBLE1BQU1DLGdCQUFnQixJQUFJQyxHQUFKLEVBQXRCOztBQUVBLFNBQVNDLFdBQVQsQ0FBcUJDLE9BQXJCLEVBQXNDO0FBQ3BDLE1BQUksQ0FBQ0gsY0FBY0ksR0FBZCxDQUFrQkQsT0FBbEIsQ0FBTCxFQUFpQztBQUMvQjtBQUNBO0FBQ0Q7QUFDRDtBQUNBTixVQUFRUSxjQUFSLENBQXVCRixPQUF2QixFQUFnQ0gsY0FBY00sR0FBZCxDQUFrQkgsT0FBbEIsQ0FBaEM7QUFDQUgsZ0JBQWNPLE1BQWQsQ0FBcUJKLE9BQXJCO0FBQ0Q7O0FBRUQsTUFBTUssU0FBTixDQUFnQjs7QUFHZEMsY0FBWVosT0FBWixFQUEwQjtBQUN4QixTQUFLQSxPQUFMLEdBQWVBLE9BQWY7QUFDRDs7QUFFRGEsVUFBUVAsT0FBUixFQUF5QlEsT0FBekIsRUFBZ0Q7QUFDOUMsU0FBS2QsT0FBTCxDQUFhZSxJQUFiLENBQWtCVCxPQUFsQixFQUEyQlEsT0FBM0I7QUFDRDtBQVRhOztBQVloQixNQUFNRSxRQUFOLFNBQXVCZixpQkFBT0MsWUFBOUIsQ0FBMkM7O0FBR3pDVSxjQUFZWixPQUFaLEVBQTBCO0FBQ3hCO0FBQ0EsU0FBS0EsT0FBTCxHQUFlQSxPQUFmO0FBQ0Q7O0FBRURpQixZQUFVWCxPQUFWLEVBQWlDO0FBQy9CRCxnQkFBWUMsT0FBWjtBQUNBLFVBQU1ZLFVBQVdKLE9BQUQsSUFBYTtBQUMzQixXQUFLQyxJQUFMLENBQVUsU0FBVixFQUFxQlQsT0FBckIsRUFBOEJRLE9BQTlCO0FBQ0QsS0FGRDtBQUdBWCxrQkFBY2dCLEdBQWQsQ0FBa0JiLE9BQWxCLEVBQTJCWSxPQUEzQjtBQUNBLFNBQUtsQixPQUFMLENBQWFvQixFQUFiLENBQWdCZCxPQUFoQixFQUF5QlksT0FBekI7QUFDRDs7QUFFRGIsY0FBWUMsT0FBWixFQUFtQztBQUNqQ0QsZ0JBQVlDLE9BQVo7QUFDRDtBQW5Cd0M7O0FBc0IzQyxTQUFTZSxlQUFULEdBQWdDO0FBQzlCLFNBQU8sSUFBSVYsU0FBSixDQUFjWCxPQUFkLENBQVA7QUFDRDs7QUFFRCxTQUFTc0IsZ0JBQVQsR0FBaUM7QUFDL0IsU0FBTyxJQUFJTixRQUFKLENBQWFoQixPQUFiLENBQVA7QUFDRDs7QUFFRCxNQUFNdUIsaUJBQWlCO0FBQ3JCRixpQkFEcUI7QUFFckJDO0FBRnFCLENBQXZCOztRQU1FQyxjLEdBQUFBLGMiLCJmaWxlIjoiRXZlbnRFbWl0dGVyTVEuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZXZlbnRzIGZyb20gJ2V2ZW50cyc7XG5cbmNvbnN0IGVtaXR0ZXIgPSBuZXcgZXZlbnRzLkV2ZW50RW1pdHRlcigpO1xuY29uc3Qgc3Vic2NyaXB0aW9ucyA9IG5ldyBNYXAoKTtcblxuZnVuY3Rpb24gdW5zdWJzY3JpYmUoY2hhbm5lbDogc3RyaW5nKSB7XG4gIGlmICghc3Vic2NyaXB0aW9ucy5oYXMoY2hhbm5lbCkpIHtcbiAgICAvL2NvbnNvbGUubG9nKCdObyBjaGFubmVsIHRvIHVuc3ViIGZyb20nKTtcbiAgICByZXR1cm47XG4gIH1cbiAgLy9jb25zb2xlLmxvZygndW5zdWIgJywgY2hhbm5lbCk7XG4gIGVtaXR0ZXIucmVtb3ZlTGlzdGVuZXIoY2hhbm5lbCwgc3Vic2NyaXB0aW9ucy5nZXQoY2hhbm5lbCkpO1xuICBzdWJzY3JpcHRpb25zLmRlbGV0ZShjaGFubmVsKTtcbn1cblxuY2xhc3MgUHVibGlzaGVyIHtcbiAgZW1pdHRlcjogYW55O1xuXG4gIGNvbnN0cnVjdG9yKGVtaXR0ZXI6IGFueSkge1xuICAgIHRoaXMuZW1pdHRlciA9IGVtaXR0ZXI7XG4gIH1cblxuICBwdWJsaXNoKGNoYW5uZWw6IHN0cmluZywgbWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5lbWl0dGVyLmVtaXQoY2hhbm5lbCwgbWVzc2FnZSk7XG4gIH1cbn1cblxuY2xhc3MgQ29uc3VtZXIgZXh0ZW5kcyBldmVudHMuRXZlbnRFbWl0dGVyIHtcbiAgZW1pdHRlcjogYW55O1xuXG4gIGNvbnN0cnVjdG9yKGVtaXR0ZXI6IGFueSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5lbWl0dGVyID0gZW1pdHRlcjtcbiAgfVxuXG4gIHN1YnNjcmliZShjaGFubmVsOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB1bnN1YnNjcmliZShjaGFubmVsKTtcbiAgICBjb25zdCBoYW5kbGVyID0gKG1lc3NhZ2UpID0+IHtcbiAgICAgIHRoaXMuZW1pdCgnbWVzc2FnZScsIGNoYW5uZWwsIG1lc3NhZ2UpO1xuICAgIH1cbiAgICBzdWJzY3JpcHRpb25zLnNldChjaGFubmVsLCBoYW5kbGVyKTtcbiAgICB0aGlzLmVtaXR0ZXIub24oY2hhbm5lbCwgaGFuZGxlcik7XG4gIH1cblxuICB1bnN1YnNjcmliZShjaGFubmVsOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB1bnN1YnNjcmliZShjaGFubmVsKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVQdWJsaXNoZXIoKTogYW55IHtcbiAgcmV0dXJuIG5ldyBQdWJsaXNoZXIoZW1pdHRlcik7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVN1YnNjcmliZXIoKTogYW55IHtcbiAgcmV0dXJuIG5ldyBDb25zdW1lcihlbWl0dGVyKTtcbn1cblxuY29uc3QgRXZlbnRFbWl0dGVyTVEgPSB7XG4gIGNyZWF0ZVB1Ymxpc2hlcixcbiAgY3JlYXRlU3Vic2NyaWJlclxufVxuXG5leHBvcnQge1xuICBFdmVudEVtaXR0ZXJNUVxufVxuIl19