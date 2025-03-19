// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title BatchProcessor
 * @notice Optimizes gas usage through batching and efficient storage
 */
contract BatchProcessor is 
    Initializable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable 
{
    using EnumerableSet for EnumerableSet.AddressSet;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    // Packed struct for gas optimization
    struct Transaction {
        address target;
        uint96 value;
        uint32 gasLimit;
        uint8 priority;
        bytes data;
    }

    // Efficient storage using packed slots
    struct BatchMetadata {
        uint32 timestamp;
        uint32 gasPrice;
        uint16 size;
        uint8 status; // 0: Pending, 1: Processing, 2: Completed, 3: Failed
        bool isUrgent;
    }

    // Storage optimizations
    mapping(uint256 => Transaction[]) private _batches;
    mapping(uint256 => BatchMetadata) private _batchMetadata;
    mapping(address => uint256) private _lastProcessedBlock;
    
    EnumerableSet.AddressSet private _whitelistedTargets;
    
    uint256 private _currentBatchId;
    uint256 private constant MAX_BATCH_SIZE = 50;
    uint256 private constant MIN_BATCH_SIZE = 5;

    // Events
    event BatchCreated(uint256 indexed batchId, uint16 size);
    event BatchProcessed(uint256 indexed batchId, uint8 status);
    event TransactionAdded(uint256 indexed batchId, address indexed target);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Pausable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    /**
     * @dev Add transaction to current batch
     * @param target Contract to call
     * @param data Call data
     * @param gasLimit Gas limit for the call
     * @param priority Priority level (0-255)
     */
    function addTransaction(
        address target,
        bytes calldata data,
        uint32 gasLimit,
        uint8 priority
    ) external whenNotPaused onlyRole(OPERATOR_ROLE) {
        require(_whitelistedTargets.contains(target), "Target not whitelisted");
        
        uint256 batchId = _currentBatchId;
        Transaction[] storage batch = _batches[batchId];

        // Create new batch if current is full
        if (batch.length >= MAX_BATCH_SIZE) {
            _currentBatchId++;
            batchId = _currentBatchId;
            batch = _batches[batchId];
        }

        // Initialize new batch metadata
        if (batch.length == 0) {
            _batchMetadata[batchId] = BatchMetadata({
                timestamp: uint32(block.timestamp),
                gasPrice: uint32(tx.gasprice),
                size: 0,
                status: 0,
                isUrgent: priority > 200
            });
        }

        // Add transaction to batch
        batch.push(Transaction({
            target: target,
            value: 0,
            gasLimit: gasLimit,
            priority: priority,
            data: data
        }));

        _batchMetadata[batchId].size++;
        
        emit TransactionAdded(batchId, target);

        // Process batch if conditions are met
        if (_shouldProcessBatch(batchId)) {
            processBatch(batchId);
        }
    }

    /**
     * @dev Process a batch of transactions
     * @param batchId Batch ID to process
     */
    function processBatch(uint256 batchId) public nonReentrant whenNotPaused {
        require(_hasRole(OPERATOR_ROLE, msg.sender), "Caller is not an operator");
        
        BatchMetadata storage metadata = _batchMetadata[batchId];
        require(metadata.status == 0, "Batch not pending");
        
        Transaction[] storage batch = _batches[batchId];
        require(batch.length >= MIN_BATCH_SIZE, "Batch too small");

        metadata.status = 1; // Processing

        // Sort by priority (bubble sort for gas efficiency with small arrays)
        for (uint i = 0; i < batch.length - 1; i++) {
            for (uint j = 0; j < batch.length - i - 1; j++) {
                if (batch[j].priority < batch[j + 1].priority) {
                    Transaction memory temp = batch[j];
                    batch[j] = batch[j + 1];
                    batch[j + 1] = temp;
                }
            }
        }

        bool success = true;
        for (uint i = 0; i < batch.length; i++) {
            Transaction memory txn = batch[i];
            
            // Skip if target was recently processed
            if (block.number - _lastProcessedBlock[txn.target] < 5) {
                continue;
            }

            (bool txSuccess,) = txn.target.call{
                gas: txn.gasLimit,
                value: txn.value
            }(txn.data);

            if (!txSuccess) {
                success = false;
                break;
            }

            _lastProcessedBlock[txn.target] = block.number;
        }

        metadata.status = success ? 2 : 3;
        emit BatchProcessed(batchId, metadata.status);
    }

    /**
     * @dev Check if batch should be processed
     * @param batchId Batch ID to check
     */
    function _shouldProcessBatch(uint256 batchId) internal view returns (bool) {
        BatchMetadata storage metadata = _batchMetadata[batchId];
        Transaction[] storage batch = _batches[batchId];

        return (
            batch.length >= MAX_BATCH_SIZE ||
            metadata.isUrgent ||
            (batch.length >= MIN_BATCH_SIZE && 
             block.timestamp - metadata.timestamp > 300) // 5 minutes
        );
    }

    /**
     * @dev Add target to whitelist
     * @param target Address to whitelist
     */
    function addWhitelistedTarget(address target) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        _whitelistedTargets.add(target);
    }

    /**
     * @dev Remove target from whitelist
     * @param target Address to remove
     */
    function removeWhitelistedTarget(address target) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        _whitelistedTargets.remove(target);
    }

    /**
     * @dev Get batch metadata
     * @param batchId Batch ID
     */
    function getBatchMetadata(uint256 batchId) 
        external 
        view 
        returns (BatchMetadata memory) 
    {
        return _batchMetadata[batchId];
    }

    /**
     * @dev Get batch size
     * @param batchId Batch ID
     */
    function getBatchSize(uint256 batchId) external view returns (uint256) {
        return _batches[batchId].length;
    }

    /**
     * @dev Emergency pause
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Resume operations
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
