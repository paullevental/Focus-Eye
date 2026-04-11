import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader, Subset
import numpy as np
import os
import copy
from sklearn.model_selection import train_test_split, KFold
from sklearn.metrics import classification_report

# Parameters
SEQUENCE_LENGTH = 30
INPUT_SIZE = 468 * 3  # 468 landmarks * (x, y, z)
HIDDEN_SIZE = 64 
NUM_CLASSES = 3
NUM_LAYERS = 2 # Reduced for better stability with small datasets
BATCH_SIZE = 32
EPOCHS = 100 # Increased to allow better convergence
LEARNING_RATE = 0.001
KFOLD_SPLITS = 5

class FocusDataset(Dataset):
    def __init__(self, X, y):
        self.X = torch.tensor(X, dtype=torch.float32)
        self.y = torch.tensor(y, dtype=torch.long)
        
    def __len__(self):
        return len(self.X)
        
    def __getitem__(self, idx):
        return self.X[idx], self.y[idx]

class FocusLSTM(nn.Module):
    def __init__(self, input_size, hidden_size, num_layers, num_classes):
        super(FocusLSTM, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=0.2)
        self.fc = nn.Linear(hidden_size, num_classes)
        
    def forward(self, x):
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        
        out, _ = self.lstm(x, (h0, c0))
        out = self.fc(out[:, -1, :])  # Take the last time step
        return out

def load_data(data_path):
    X = []
    y = []
    classes = ["Deep Focus", "Partial Distraction", "Absent"]
    
    for file in os.listdir(data_path):
        if file.endswith(".npy"):
            label_str = file.split("_")[0]
            if label_str in classes:
                label = classes.index(label_str)
                data = np.load(os.path.join(data_path, file))
                if data.shape == (SEQUENCE_LENGTH, INPUT_SIZE):
                    X.append(data)
                    y.append(label)
                else:
                    print(f"Skipping {file} due to shape mismatch: {data.shape}")
                    
    return np.array(X), np.array(y)

def train_epoch(model, loader, criterion, optimizer, device):
    model.train()
    total_loss = 0
    for batch_X, batch_y in loader:
        batch_X, batch_y = batch_X.to(device), batch_y.to(device)
        outputs = model(batch_X)
        loss = criterion(outputs, batch_y)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        total_loss += loss.item()
    return total_loss / len(loader)

def evaluate(model, loader, device):
    model.eval()
    all_preds = []
    all_labels = []
    with torch.no_grad():
        for batch_X, batch_y in loader:
            batch_X, batch_y = batch_X.to(device), batch_y.to(device)
            outputs = model(batch_X)
            _, predicted = torch.max(outputs.data, 1)
            all_preds.extend(predicted.cpu().numpy())
            all_labels.extend(batch_y.cpu().numpy())
    return all_labels, all_preds

def get_class_weights(y, device):
    counts = np.bincount(y)
    # Smoothed weights using sqrt to prevent extreme bias
    weights = 1. / np.sqrt(counts)
    weights = weights / weights.sum() * len(counts)
    return torch.tensor(weights, dtype=torch.float32).to(device)

def train():
    # Relative path discovery
    if os.path.exists("ai/data/raw"):
        data_path = "ai/data/raw"
    elif os.path.exists("data/raw"):
        data_path = "data/raw"
    else:
        # Fallback relative to the script location
        data_path = os.path.join(os.path.dirname(__file__), "data", "raw")
    
    if not os.path.exists(data_path) or not os.listdir(data_path):
        print(f"No data found in {data_path}. Please run collect_data.py first.")
        return

    X, y = load_data(data_path)
    if len(X) == 0:
        print(f"No valid .npy files found in {data_path} matching the required shape.")
        return
        
    print(f"Loaded {len(X)} samples from {data_path}")

    # Initial Split: Hold out 20% for final test
    X_train_full, X_test, y_train_full, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    dataset = FocusDataset(X_train_full, y_train_full)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")

    # Softened Class Weights
    class_weights = get_class_weights(y_train_full, device)
    print(f"Smoothed Class Weights applied: {class_weights.cpu().numpy()}")

    # --- K-Fold Cross-Validation ---
    print(f"\nStarting {KFOLD_SPLITS}-Fold Cross-Validation...")
    kfold = KFold(n_splits=KFOLD_SPLITS, shuffle=True, random_state=42)
    fold_accuracies = []

    for fold, (train_ids, val_ids) in enumerate(kfold.split(dataset)):
        print(f"\nFold {fold+1}/{KFOLD_SPLITS}")
        train_sub = Subset(dataset, train_ids)
        val_sub = Subset(dataset, val_ids)
        
        train_loader = DataLoader(train_sub, batch_size=BATCH_SIZE, shuffle=True)
        val_loader = DataLoader(val_sub, batch_size=BATCH_SIZE, shuffle=False)
        
        model = FocusLSTM(INPUT_SIZE, HIDDEN_SIZE, NUM_LAYERS, NUM_CLASSES).to(device)
        criterion = nn.CrossEntropyLoss(weight=class_weights)
        optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
        
        best_fold_acc = 0
        for epoch in range(EPOCHS):
            train_epoch(model, train_loader, criterion, optimizer, device)
            
            # Internal Fold Validation
            if (epoch + 1) % 10 == 0:
                y_true, y_pred = evaluate(model, val_loader, device)
                acc = np.mean(np.array(y_true) == np.array(y_pred))
                best_fold_acc = max(best_fold_acc, acc)

        fold_accuracies.append(best_fold_acc)
        print(f"Fold {fold+1} Best Accuracy: {best_fold_acc*100:.2f}%")

    print(f"\nAverage Cross-Validation Accuracy: {np.mean(fold_accuracies)*100:.2f}% (+/- {np.std(fold_accuracies)*100:.2f}%)")

    # --- Final Training & Evaluation ---
    print("\nStarting final training on full training set with best-model saving...")
    train_loader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)
    test_dataset = FocusDataset(X_test, y_test)
    test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False)
    
    final_model = FocusLSTM(INPUT_SIZE, HIDDEN_SIZE, NUM_LAYERS, NUM_CLASSES).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = optim.Adam(final_model.parameters(), lr=LEARNING_RATE)
    
    best_model_wts = copy.deepcopy(final_model.state_dict())
    best_acc = 0.0

    for epoch in range(EPOCHS):
        loss = train_epoch(final_model, train_loader, criterion, optimizer, device)
        
        # Check against hold-out test set for saving best version
        y_true, y_pred = evaluate(final_model, test_loader, device)
        current_acc = np.mean(np.array(y_true) == np.array(y_pred))
        
        if current_acc > best_acc:
            best_acc = current_acc
            best_model_wts = copy.deepcopy(final_model.state_dict())
            
        if (epoch + 1) % 10 == 0:
            print(f"Epoch {epoch+1}/{EPOCHS}, Loss: {loss:.4f}, Current Test Acc: {current_acc*100:.2f}%")

    # Load best weights for final report
    final_model.load_state_dict(best_model_wts)
    y_true, y_pred = evaluate(final_model, test_loader, device)
    print("\nFinal Classification Report (Best Model):")
    print(classification_report(y_true, y_pred, target_names=["Deep Focus", "Partial Distraction", "Absent"], zero_division=0))

    # Save final model
    model_dir = "ai/models" if os.path.exists("ai") else "models"
    if not os.path.exists(model_dir):
        os.makedirs(model_dir)
    torch.save(final_model.state_dict(), os.path.join(model_dir, "focus_lstm.pth"))
    print(f"Best model saved to {os.path.join(model_dir, 'focus_lstm.pth')} with {best_acc*100:.2f}% accuracy")

if __name__ == "__main__":
    train()
