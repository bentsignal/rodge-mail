const fs = require("node:fs");
const path = require("node:path");
const {
  IOSConfig,
  withAppDelegate,
  withXcodeProject,
} = require("expo/config-plugins");

const HANDLER_FILE = "NotificationQuickActionHandler.swift";
const INSTALL_CALL = "NotificationQuickActionHandler.install()";

function withIosNotificationQuickActions(config) {
  config = withAppDelegate(config, (config) => {
    const source = config.modResults.contents;
    if (source.includes(INSTALL_CALL)) return config;

    const returnStatement =
      "return super.application(application, didFinishLaunchingWithOptions: launchOptions)";
    if (!source.includes(returnStatement)) {
      throw new Error(
        "Could not install the iOS notification quick-action handler in AppDelegate.swift",
      );
    }
    config.modResults.contents = source.replace(
      returnStatement,
      `let didFinishLaunching = super.application(application, didFinishLaunchingWithOptions: launchOptions)
    ${INSTALL_CALL}
    return didFinishLaunching`,
    );
    return config;
  });

  return withXcodeProject(config, (config) => {
    const projectRoot = config.modRequest.platformProjectRoot;
    const projectName = IOSConfig.XcodeUtils.getProjectName(
      config.modRequest.projectRoot,
    );
    const handlerPath = path.join(projectRoot, projectName, HANDLER_FILE);
    fs.writeFileSync(handlerPath, createHandlerSource());
    IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
      filepath: `${projectName}/${HANDLER_FILE}`,
      groupName: projectName,
      project: config.modResults,
    });
    return config;
  });
}

function createHandlerSource() {
  return `internal import ExpoNotifications
import Foundation
import UserNotifications

final class NotificationQuickActionHandler: NSObject, UNUserNotificationCenterDelegate {
  private static let shared = NotificationQuickActionHandler()
  private static let silentActions: Set<String> = ["pin", "mark-read", "archive"]
  private var forwardedDelegate: UNUserNotificationCenterDelegate?

  static func install() {
    let center = UNUserNotificationCenter.current()
    shared.forwardedDelegate = NotificationCenterManager.shared
    center.delegate = shared
    registerCategories(in: center)
  }

  private static func registerCategories(in center: UNUserNotificationCenter) {
    let pin = UNNotificationAction(identifier: "pin", title: "Pin", options: [])
    let markRead = UNNotificationAction(identifier: "mark-read", title: "Mark Read", options: [])
    let archive = UNNotificationAction(identifier: "archive", title: "Archive", options: [])
    let unsubscribe = UNNotificationAction(
      identifier: "unsubscribe",
      title: "Unsubscribe",
      options: [.destructive, .foreground]
    )
    center.setNotificationCategories([
      UNNotificationCategory(
        identifier: "newMailActions",
        actions: [pin, markRead, archive],
        intentIdentifiers: []
      ),
      UNNotificationCategory(
        identifier: "newMailListActions",
        actions: [pin, markRead, archive, unsubscribe],
        intentIdentifiers: []
      ),
    ])
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    guard let forwardedDelegate else {
      completionHandler([])
      return
    }
    forwardedDelegate.userNotificationCenter?(
      center,
      willPresent: notification,
      withCompletionHandler: completionHandler
    )
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    guard Self.silentActions.contains(response.actionIdentifier) else {
      forward(center, response: response, completionHandler: completionHandler)
      return
    }

    center.removeDeliveredNotifications(withIdentifiers: [response.notification.request.identifier])
    guard let request = makeRequest(for: response) else {
      forward(center, response: response, completionHandler: completionHandler)
      return
    }
    URLSession.shared.dataTask(with: request) { _, _, _ in
      completionHandler()
    }.resume()
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    openSettingsFor notification: UNNotification?
  ) {
    forwardedDelegate?.userNotificationCenter?(center, openSettingsFor: notification)
  }

  private func forward(
    _ center: UNUserNotificationCenter,
    response: UNNotificationResponse,
    completionHandler: @escaping () -> Void
  ) {
    guard let forwardedDelegate else {
      completionHandler()
      return
    }
    forwardedDelegate.userNotificationCenter?(
      center,
      didReceive: response,
      withCompletionHandler: completionHandler
    )
  }

  private func makeRequest(for response: UNNotificationResponse) -> URLRequest? {
    let userInfo = response.notification.request.content.userInfo
    let data = userInfo["body"] as? [String: Any] ?? userInfo as? [String: Any]
    guard
      let data,
      let urlValue = data["quickActionUrl"] as? String,
      let url = URL(string: urlValue),
      url.scheme == "https",
      let deliveryId = data["quickActionDeliveryId"] as? String,
      let token = data["quickActionToken"] as? String
    else {
      return nil
    }

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.timeoutInterval = 20
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try? JSONSerialization.data(withJSONObject: [
      "action": response.actionIdentifier,
      "deliveryId": deliveryId,
      "token": token,
    ])
    return request.httpBody == nil ? nil : request
  }
}
`;
}

module.exports = withIosNotificationQuickActions;
module.exports.createHandlerSource = createHandlerSource;
